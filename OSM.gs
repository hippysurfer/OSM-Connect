/*
  Online Scout Manager library.

  Author: Richard Taylor (7th Lichfield Scout Group)

  NOTE1: I am not a Javascript developer! Please don't judge too harshly!


  Basic usage:

    var service = getOSMService();        // Fetch the Oauth token
    var osm = OSM(service).init();        // Fetch the basic resouces from OSM
    var all_sections = osm.fetch_roles(); // Fetch a list of accessable sections

*/

var BASE_URL = "https://www.onlinescoutmanager.co.uk/";

var DEBUG = false;  // Set to true to log more stuff.

function OSM(OSMService) {
  return new OSM_(OSMService);
}

class OSM_ {
  constructor(OSMService) {
    this.service = OSMService;
    this.cache_expiry = 60 * 60; // Cache expires after 1 hour.
    this.fetcher = UrlFetchApp.fetch; // Allow for injecting test version.
    this.ratelimit_remaining = -1; // This will be set by the first fetch.
    this.ratelimit_reset = -1; // This will be set by the first fetch.
    this.sections = [];
    this.scopes = [];

    this.crusher = new cUseful.CrusherPluginCacheService().init({
      store: CacheService.getUserCache()
    });

  }

  init() {
    var resources = this.fetch('https://www.onlinescoutmanager.co.uk/oauth/resource',
      undefined, undefined, 'get');
    this.sections = resources.data.sections;
    this.scopes = resources.data.scopes;

    return this;
  }

  fetch(url, section_id, term_id, method) {

    // Add the base url if a full url is not provided.
    if (!url.startsWith("https://")) {
      var url = BASE_URL + url;
    }

    // Build a unique key for the cache
    var cache_key = url;

    if (typeof section_id !== 'undefined') {
      cache_key += section_id;
    }
    if (typeof term_id !== 'undefined') {
      cache_key += term_id;
    }

    // Uncomment to force real http requests even if the url is in the cache.
    // Use for debug.
    //this.crusher.remove(cache_key);

    // Returned cached version if there is one.
    var result = this.crusher.get(cache_key);
    if (result != null) {
      Logger.log("Cache hit for: " + url);
      //Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    // Stop if we have exceeded the rate limit.
    if (this.ratelimit_remaining == 0) {
      throw new Error(
        "Rate limit has reached zero, stopping any more fetches to avoid being banned. " +
        "Limit will be reset in " + Math.floor(this.ratelimit_reset / 60) + "m " +
        (this.ratelimit_reset - (Math.floor(this.ratelimit_reset / 60) * 60)) + "s.");
    }

    // Actually perform the fetch from OSM.
    var result = this.fetch_(url, section_id, term_id, method);

    //Logger.log(JSON.stringify(result, null, 2));

    // Add to cache.
    this.crusher.put(cache_key, result, this.cache_expiry);

    return result;
  }

  fetch_(url, section_id, term_id, method) {

    var values = {};

    if (typeof section_id !== 'undefined') {
      values['section_id'] = section_id;
    }
    if (typeof term_id !== 'undefined') {
      values['term_id'] = term_id;
    }

    // Allow overriding the method because a few API calls require 'get'.
    if (typeof method === 'undefined') {
      method = 'post'
    }

    //var token = this.service.getAccessToken();
    //Logger.log(token);

    var options = {
      'method': method,
      'payload': values,
      'headers': {
        Authorization: 'Bearer ' + this.service.getAccessToken()
      },
      'muteHttpExceptions': false
    };

    var response = this.fetcher(url, options);
    var response_code = response.getResponseCode();

    if (response_code != 200) {
      // Something went wrong.
      throw new Error("HTTP fetch for " + url + " failed. Return code: " + response_code);
    }

    // Check the ratelimiting headers
    // NOTE: This code is rather tricky to test without getting blocked.
    //       It could really do with some outside review.
    var headers = response.getAllHeaders();
    this.ratelimit_remaining = parseInt(headers["x-ratelimit-remaining"]);
    var ratelimit_limit = parseInt(headers["x-ratelimit-limit"]);
    this.ratelimit_reset = parseInt(headers["x-ratelimit-reset"]);

    if (this.ratelimit_remaining < (ratelimit_limit / 10)) {
      // Warn if we are above 90%
      Logger.log(
        "Rate limit is above 90%. " + this.ratelimit_remaining + " remaining. " +
        "Limit will be reset in " +
        Math.floor(this.ratelimit_reset / 60) + "m " +
        (this.ratelimit_reset - (Math.floor(this.ratelimit_reset / 60) * 60)) + "s.");
    }
    // Attempt to parse the return JSON object.
    return JSON.parse(response.getContentText());
  };


  /////////////////
  //
  //  Roles and sections
  //
  /////////////////

  fetch_roles(filter_no_term, filter_scope_access, filter_section_type) {
    var roles = this.fetch('api.php?action=getUserRoles');

    var osm = this;

    // Filter out any sections that we do not have permission to read from their
    // event data.
    if (filter_scope_access !== undefined) {
      roles = roles.filter(
        function (section) {
          return osm.has_read_permission(osm.fetch_permissions(section.sectionid), filter_scope_access);
        });
    }

    // Filter out sections that do not have a valid term.
    if (filter_no_term === true) {
      roles = roles.filter(
        function (section) {
          return (osm.active_term_id(section.sectionid) !== undefined);
        });
    }

    // Filter to return only the requested section type
    if (filter_section_type !== undefined)  {
      roles = roles.filter(
        function (elem) { 
          return (elem.section === filter_section_type);
        })
    }

    // Sort the sections in a natural order to help with UI display.
    var sorted_roles = [].concat(
      roles.filter(function (elem) { return (elem.section === "earlyyears") }),
      roles.filter(function (elem) { return (elem.section === "beavers") }),
      roles.filter(function (elem) { return (elem.section === "cubs") }),
      roles.filter(function (elem) { return (elem.section === "scouts") }),
      roles.filter(function (elem) {
        return (
          (elem.section != "earlyyears") &&
          (elem.section != "beavers") &&
          (elem.section != "cubs") &&
          (elem.section != "scouts"))
      })
    );

    return sorted_roles;
  };

  authorised_sections() {
    var roles = this.fetch_roles();
    var sections = [];
    for (var section in roles) {
      var sectionname = roles[section]["sectionname"];
      sections.push(sectionname);
    };
    return sections;
  }

  fetch_permissions(section_id) {
    var roles = this.fetch_roles();
    var permissions = search(section_id, 'sectionid', roles)['permissions'];
    return permissions;
  }

  can_access_events(section_id) {
    return this.has_read_permission(this.fetch_permissions(section_id), "events");
  }

  can_access_flexirecords(section_id) {
    return this.has_read_permission(this.fetch_permissions(section_id), "flexi");
  }

  can_access_badges(section_id) {
    return this.has_read_permission(this.fetch_permissions(section_id), "badge");
  }

  can_access_members(section_id) {
    return this.has_read_permission(this.fetch_permissions(section_id), "member");
  }

  can_access_users(section_id) {
    return this.has_read_permission(this.fetch_permissions(section_id), "user");
  }

  can_access_registers(section_id) {
    return this.has_read_permission(this.fetch_permissions(section_id), "register");
  }

  can_access_programmes(section_id) {
    return this.has_read_permission(this.fetch_permissions(section_id), "program");
  }

  can_access_finances(section_id) {
    return this.has_read_permission(this.fetch_permissions(section_id), "finance");
  }

  can_access_quartermasters(section_id) {
    return this.has_read_permission(this.fetch_permissions(section_id), "quartermaster");
  }

  has_read_permission(permission_array, area) {
    return ((permission_array[area] != undefined) && (permission_array[area] != "0"));
  };

  /////////////////
  //
  //  Terms
  //
  /////////////////

  fetch_terms() {
    var terms = this.fetch('api.php?action=getTerms');
    for (var key in terms) {
      terms[key].map(
        function (term) {
          term.startdate = new Date(term.startdate);
          term.enddate = new Date(term.enddate);
        }
      );
    }
    return terms;
  };

  all_term_ids(section_id) {
    return this.fetch_terms()[section_id].map(
      function (term) {
        return term.termid;
      }
    );
  };

  active_term(section_id) {
    var terms = this.fetch_terms()[section_id];
    var today = new Date();
    if (terms === undefined) {
      return;
    }
    var active_terms = terms.filter(
      function (term) {
        return (term.startdate < today) && (term.enddate > today);
      }
    );
    return active_terms[0];
  };

  active_term_id(section_id) {
    var active = this.active_term(section_id);
    if (active === undefined) {
      return -1;
    }
    return active.termid;
  };

  active_terms() {
    var sections = this.fetch_roles();
    var terms = sections.map(
      function (term) {
        return this.active_term(term.sectionid);
      }
    );
    return terms;
  };

  /////////////////
  //
  //  Members
  //
  /////////////////

  fetch_members(section) {
    var result = this.fetch(
      "ext/members/contact/grid/?action=getMembers" + "&dateFormat=uk",
      section.sectionid,
      this.active_term_id(section.sectionid));
    var values = [];
    for (var key in result.data) {
      values.push(result.data[key]);
    }
    result = values.map(
      function (elem) {
        elem['section_name'] = section.sectionname;
        elem['section_type'] = section.section;
        return elem;
      }
    );
    return result;
  }


  /////////////////
  //
  //  Payment schedules
  //
  /////////////////

  fetch_schedules(sectionid, schemeid) {
    var result = this.fetch("ext/finances/onlinepayments/?action=getPaymentSchedule&allpayments=1&sectionid=" + sectionid + "&schemeid=" + schemeid);
    var payments = result.payments;

    payments = payments.filter(
      function (elem) {
        return !elem.is_past;
      });

    payments.map(
      function (elem) {
        elem.scheme = result.name;
      });

    return payments;
  }


  fetch_schemes(sectionid) {
    var result = this.fetch("ext/finances/onlinepayments/?action=getSchemes&sectionid=" + sectionid);

    return result.items;
  }

  fetch_payments(sectionid, scheme) {
    var schedule = this.fetch(
      "ext/finances/onlinepayments/?action=getPaymentSchedule&sectionid=" + sectionid +
      "&schemeid=" + scheme.schemeid + "&termid=" + this.active_term_id(sectionid));

    var status = this.fetch(
      "ext/finances/onlinepayments/?action=getPaymentStatus&sectionid=" + sectionid +
      "&schemeid=" + scheme.schemeid + "&termid=" + this.active_term_id(sectionid));

    if (scheme.name === "Discounted Subscriptions for 7th Lichfield Scout Group") {
      // Fix up wrongly named payment schedule in the Group Subs
      schedule.payments.map(
        function (payment) {
          if (payment.date === '2017-02-20') {
            payment.name = '2017 - Spring Term - Part 2';
          }
        });
    }

    // Filter archived payments
    schedule.payments = schedule.payments.filter(
      function (payment) {
        return (payment.archived === '0');
      });

    // Normalise the status information
    function get_status(d) {
      if (d === undefined || d.length == 0) {
        return "Payment Required?";
      }
      var detail = d.filter(function (elem) {
        return (elem.latest === "1");
      });
      return detail[0].status;
    }

    // get a list of all payments by person.
    var payments = status.items.map(
      function (item) {
        return schedule.payments.map(
          function (payment) {
            var ret = {};
            ret.scoutid = item.scoutid;
            ret.firstname = item.firstname;
            ret.lastname = item.lastname;
            ret.schedule = schedule.name;
            ret.payment = payment.name;
            ret.payment_date = payment.date;
            ret.payment_amount = payment.amount;
            var cooked = JSON.parse(item[payment.paymentid]);
            ret.status = get_status(JSON.parse(item[payment.paymentid])['status']);
            return ret;
          }
        );
      }
    )

    var merged = [].concat.apply([], payments);
    return merged;
  }

  /////////////////
  //
  //  Events
  //
  /////////////////

  fetch_all_events() {

    var all_sections = this.fetch_roles(true, 'events');

    var osm = this;

    var all_events = all_sections.map(
      function (section) {
        var section_name = section.sectionname;
        var term_id = osm.active_term_id(section.sectionid);
        if (term_id === undefined) {
          throw "No active term for section=" + section_name;
        }
        var result = osm.fetch("ext/events/summary/?action=get&sectionid=" + section.sectionid + "&termid=" + term_id);

        if (result === null) { return null; };
        result = result.items.map(
          function (elem) {
            elem.sectionname = section.sectionname;
            elem.sectionid = section.sectionid;
            elem.section = section.section;
            elem.startdate_g = new Date(elem.startdate_g);
            return elem;
          }
        );
        return result;
      }
    );

    all_events = all_events.filter(
      function (elem) {
        return (elem !== null);
      }
    ); // filter sections that we can't access events for.

    all_events = [].concat.apply([], all_events); // flatten lists.
    all_events = all_events.sort(
      function (elem1, elem2) {
        return (elem2.startdate_g - elem1.startdate_g);
      }
    );
    return all_events;
  }

  fetch_uniq_event_names() {
    var all_events = this.fetch_all_events();

    var all_event_names = all_events.map(
      function (elem) {
        return elem.name;
      }
    );

    function onlyUnique(value, index, self) {
      return self.indexOf(value) === index;
    }

    var unique = all_event_names.filter(onlyUnique);

    return unique;
  }

  fetch_event_details(event) {

    var structure = this.fetch(
      "ext/events/event/?action=getStructureForEvent&eventid=" +
      event.eventid + "&sectionid=" + event.sectionid);

    var fields = structure.structure[0].rows.concat(structure.structure[1].rows);
    var field_names = fields.map(
      function (elem) {
        return elem.field;
      }
    );
    var patrols = this.fetch(
      "ext/settings/patrols/?action=get&sectionid=" + event.sectionid).patrols;

    var result = this.fetch(
      "ext/events/event/?action=getAttendance&eventid=" + event.eventid + "&sectionid=" +
      event.sectionid + "&termid=" + this.active_term_id(event.sectionid));

    var fields_to_ignore = ['photo_guid', '_filterString'];

    result = result.items.map(
      function (elem) {
        for (var key in elem) {
          //log(key);
          if (fields_to_ignore.indexOf(key) != -1) {
            delete elem[key];
          }
          if (field_names.indexOf(key) != -1) {
            var new_key = search(key, 'field', fields).name;
            Object.defineProperty(elem, new_key,
              Object.getOwnPropertyDescriptor(elem, key));
            delete elem[key];
          }
        };
        elem.sectionname = event.sectionname;
        elem.section = event.section;
        var patrol = search(elem.patrolid.toString(), 'patrolid', patrols);
        if (patrol === undefined) {
          elem.patrol = 'unknown';
        } else {
          elem.patrol = patrol.name;
        }
        return elem;
      }
    );
    return result;
  }

  /////////////////
  //
  //  Movers
  //
  /////////////////

  fetch_movers(section) {
    var flexi_url = "ext/members/flexirecords/?action=getFlexiRecords&sectionid=" + section.sectionid + "&archived=n";
    var flexi_records = this.fetch(flexi_url);

    if (flexi_records === undefined) {
      debug("Can't access flexi records for " + section.sectionname);
      return [];
    };

    var moving_on_table = "";
    for (var item in flexi_records['items']) {
      if (flexi_records['items'][item]['name'] == 'Moving On') {
        moving_on_table = flexi_records['items'][item];
      };
    };

    if (moving_on_table === "") {
      debug("No movers table for section " + section.sectionname);
      return [];
    };

    var moving_on_table_id = moving_on_table['extraid'];

    var headers = this.fetch(
      "ext/members/flexirecords/?action=getStructure&sectionid=" + section.sectionid + "&extraid=" + moving_on_table_id);

    var config = JSON.parse(headers.config)

    var custom_fields = {};
    config.forEach(function (header) {
      custom_fields[header.id] = header.name;
    });

    var raw_data = this.fetch(
      "ext/members/flexirecords/?action=getData&extraid=" + moving_on_table_id + "&sectionid=" + section.sectionid + "&termid=" + this.active_term_id(section.sectionid));

    var cooked_data = raw_data.items.map(function (member) {
      var new_member = {};
      new_member['sectionname'] = section.sectionname;  // Inject the section name header
      new_member['section'] = section.section;  // Inject the section name header
      for (var key in member) {
        if (custom_fields.hasOwnProperty(key)) {
          new_member[custom_fields[key]] = member[key];
        } else {
          new_member[key] = member[key];
        };
      };
      return new_member;
    });

    return cooked_data;
  }

  /////////////////
  //
  //  Movers
  //
  /////////////////

  fetch_register_all_terms(section) {
    var osm = this;

    return [].concat.apply(
      [],
      osm.all_term_ids(section.sectionid).map(
        function (termid) {
          return osm.fetch_register(section, termid);
        }
      )
    );
  }

  fetch_register(section, termid) {
    var headers = this.fetch(
      "ext/members/attendance/?action=structure&sectionid=" + section.sectionid + "&termid=" + termid + "&section=" + section.section);

    var dates = headers[1].rows;

    var raw_data = this.fetch(
      "ext/members/attendance/?action=get&sectionid=" + section.sectionid + "&termid=" + termid + "&section=" + section.section);

    var members = raw_data.items;

    var rows = dates.map(
      function (date) {
        var row = [];
        row.push(section.section);
        row.push(section.sectionname);
        row.push(date['name']);
        row.push(date['tooltip']);
        row.push(members.filter(
          function (member) {
            return member.hasOwnProperty(date['name']);
          }
        ).length);
        row.push(members.filter(
          function (member) {
            return member.hasOwnProperty(date['name']) && (member['patrol'] === "Leaders");
          }
        ).length);
        row.push(members.filter(
          function (member) {
            return member.hasOwnProperty(date['name']) && (member['patrol'] === "Young Leaders");
          }
        ).length);
        row.push(members.filter(
          function (member) {
            return member.hasOwnProperty(date['name']) && ((member['patrol'] !== "Young Leaders") && (member['patrol'] !== "Leaders"));
          }
        ).length);
        return row;
      }
    );

    return rows;
  }

  /////////////////
  //
  //  Payments
  //
  /////////////////

  fetch_schemes(sectionid) {
    var result = this.fetch("ext/finances/onlinepayments/?action=getSchemes&sectionid=" + sectionid);

    return result.items;
  }

  fetch_payments(sectionid, scheme) {
    var schedule = this.fetch(
      "ext/finances/onlinepayments/?action=getPaymentSchedule&sectionid=" + sectionid + "&schemeid=" +
      scheme.schemeid + "&termid=" + this.active_term_id(sectionid));
    var status = this.fetch("ext/finances/onlinepayments/?action=getPaymentStatus&sectionid=" + sectionid + "&schemeid=" +
      scheme.schemeid + "&termid=" + this.active_term_id(sectionid));

    // if (scheme.name === "Discounted Subscriptions for 7th Lichfield Scout Group") {
    //   // Fix up wrongly named payment schedule in the Group Subs
    //   schedule.payments.map(
    //     function (payment) {
    //       if (payment.date === '2017-02-20') {
    //         payment.name = '2017 - Spring Term - Part 2';
    //       }
    //     });
    // }

    // Filter archived payments
    schedule.payments = schedule.payments.filter(
      function (payment) {
        return (payment.archived === '0');
      });

    // Normalise the status information
    function get_status(d) {
      if (d === undefined || d.length == 0) {
        return "Payment Required?";
      }
      var detail = d.filter(function (elem) {
        return (elem.latest === "1");
      });
      return detail[0].status;
    }

    // get a list of all payments by person.
    var payments = status.items.map(
      function (item) {
        return schedule.payments.map(
          function (payment) {
            var ret = {};
            ret.scoutid = item.scoutid;
            ret.firstname = item.firstname;
            ret.lastname = item.lastname;
            ret.schedule = schedule.name;
            ret.payment = payment.name;
            ret.payment_date = payment.date;
            ret.payment_amount = payment.amount;
            var cooked = JSON.parse(item[payment.paymentid]);
            ret.status = get_status(JSON.parse(item[payment.paymentid])['status']);
            return ret;
          }
        );
      }
    )

    var merged = [].concat.apply([], payments);
    return merged;
  }

  /////////////////
  //
  //  Awards
  //
  /////////////////

  fetch_awards(section) {
    const major_award_ids = new Map([
      ['squirrels', '14771'],
      ['beavers', '1529'],
      ['cubs', '1587'],
      ['scouts', '1539'],
    ])
    const major_award_names = new Map([
      ['squirrels', 'Acorn'],
      ['beavers', 'Bronze'],
      ['cubs', 'Silver'],
      ['scouts', 'Gold'],
    ])
    var result = this.fetch(
      "ext/badges/records/?action=getBadgeRecords" + "&dateFormat=uk" + "&section="+ section.section + "&badge_id=" + major_award_ids.get(section.section) + "&badge_version=0",
      section.sectionid,
      this.active_term_id(section.sectionid));
    var values = [];
    for (var key in result.items) {
      values.push(result.items[key]);
    }
    result = values.map(
      function (elem) {
        elem['section_name'] = section.sectionname;
        elem['section_type'] = section.section;
        elem['award_name'] = major_award_names.get(section.section);
        return elem;
      }
    );
    return result;
  }
}

