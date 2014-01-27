
  var pluginName = "intlTelInput",
    id = 1, // give each instance it's own id for namespaced event handling
    defaults = {
      // united states and united kingdom
      preferredCountries: ["us", "gb"],
      americaMode: false,
      onlyCountries: [],
      defaultStyling: "inside",
      autoHideDialCode: true,
      defaultCountry: "",
      // character to appear between dial code and phone number
      dcDelimiter: " "
    },
    keys = {
      UP: 38,
      DOWN: 40,
      ENTER: 13,
      ESCAPE: 27,
      A: 65,
      Z: 90
    };

  function Plugin(element, options) {
    this.element = element;

    this.options = $.extend({}, defaults, options);

    this._defaults = defaults;
    this.id = id++;
    this._name = pluginName;

    this.init();
  }

  Plugin.prototype = {

    init: function() {
      // process all the data: onlyCounties, preferredCountries, defaultCountry etc
      this._processCountryData();

      // generate the markup
      this._generateMarkup();

      // conditionally set the input's initial value
      this._setInitialValue();

      // start all of the event listeners: autoHideDialCode, input keyup, selectedFlag click
      this._initListeners();
    },



    /********************
     *  PRIVATE METHODS
     ********************/


    _processCountryData: function() {
      // set the global data object
      this._setGlobalIntlData();

      // set the preferredCountries property
      this._setPreferredCountries();

      // set the defaultCountry property
      this._setDefaultCountry();
    },


    // process onlyCountries array if present
    _setGlobalIntlData: function() {
      var that = this;

      if (this.options.onlyCountries.length > 0) {
        var newCountries = [],
          newCountryCodes = {};
        $.each(this.options.onlyCountries, function(i, countryCode) {
          var countryData = that._getCountryData(countryCode, true);
          if (countryData) {
            newCountries.push(countryData);

            var callingCode = countryData["calling-code"];
            if (newCountryCodes[callingCode]) {
              newCountryCodes[callingCode].push(countryCode);
            } else {
              newCountryCodes[callingCode] = [countryCode];
            }
          }
        });

        window.intlData = {
          countries: newCountries,
          countryCodes: newCountryCodes
        };
      } else {
        window.intlData = intlDataFull;
      }
    },


    // process preferred countries - iterate through the preferences,
    // finding the relevant data from the provided intlData.countries array
    _setPreferredCountries: function() {
      var that = this;
      this.preferredCountries = [];
      $.each(this.options.preferredCountries, function(i, countryCode) {
        var countryData = that._getCountryData(countryCode, false);
        if (countryData) {
          that.preferredCountries.push(countryData);
        }
      });
    },


    _setDefaultCountry: function() {
      // if the default country option is set then use it
      if (this.options.defaultCountry) {
        this.defaultCountry = this._getCountryData(this.options.defaultCountry, false);
      } else {
        this.defaultCountry = (this.preferredCountries.length) ? this.preferredCountries[0] : intlData.countries[0];
      }
    },


    _generateMarkup: function() {
      // telephone input
      this.telInput = $(this.element);

      // containers (mostly for positioning)
      var mainClass = "intl-tel-input";
      if (this.options.defaultStyling != "none") {
        mainClass += " pretty " + this.options.defaultStyling;
      }
      this.telInput.wrap($("<div>", {
        "class": mainClass
      }));
      var flagsContainer = $("<div>", {
        "class": "flag-dropdown"
      }).insertAfter(this.telInput);

      // currently selected flag (displayed to left of input)
      var selectedFlag = $("<div>", {
        "class": "selected-flag"
      }).appendTo(flagsContainer);
      // here we default to the first country in the list
      this.selectedFlagInner = $("<div>", {
        "class": "flag " + this.defaultCountry.cca2
      }).appendTo(selectedFlag);
      // CSS triangle
      $("<div>", {
        "class": "arrow"
      }).appendTo(this.selectedFlagInner);

      // country list contains: preferred countries, then divider, then all countries
      this.countryList = $("<ul>", {
        "class": "country-list hide"
      }).appendTo(flagsContainer);
      if (this.preferredCountries.length) {
        this._appendListItems(this.preferredCountries, "preferred");
        $("<li>", {
          "class": "divider"
        }).appendTo(this.countryList);
      }
      this._appendListItems(intlData.countries, "");

      this.countryListItems = this.countryList.children(".country");
      // auto select the top one
      this.countryListItems.first().addClass("active");

      // make sure the initial selected flag markup is correct
      this._updateFlagFromInputVal();
    },


    _setInitialValue: function() {
      // if autoHideDialCode is disabled (and input is not pre-populated),
      // insert the default dial code
      if (!this.options.autoHideDialCode && this.telInput.val() === "") {
        this._resetToDialCode(this.defaultCountry["calling-code"]);
      }
    },


    _initListeners: function() {
      var that = this;

      // auto hide dial code option
      if (this.options.autoHideDialCode) {
        this._initAutoHideDialCode();
      }

      // update flag on keyup
      // (by extracting the dial code from the input value)
      this.telInput.keyup(function() {
        that._updateFlagFromInputVal();
      });

      // toggle country dropdown on click
      var selectedFlag = this.selectedFlagInner.parent();
      selectedFlag.click(function(e) {
        // only intercept this event if we're opening the dropdown
        // else let it bubble up to the top ("click-off-to-close" listener)
        // we cannot just stopPropagation as it may be needed to close another instance
        if (that.countryList.hasClass("hide") && !that.telInput.prop("disabled")) {
          that._showDropdown();
        }
      });
    },


    _initAutoHideDialCode: function() {
      var that = this;

      // on focus: if empty, insert the dial code for the currently selected flag
      this.telInput.focus(function() {
        var value = $.trim(that.telInput.val());
        if (value.length === 0) {
          var countryCode = that.selectedFlagInner.attr("class").split(" ")[1];
          var countryData = that._getCountryData(countryCode, false);
          that._resetToDialCode(countryData["calling-code"]);
        }
      });

      // on blur: if just a dial code then remove it
      this.telInput.blur(function() {
        var value = $.trim(that.telInput.val());
        if (value.length > 0) {
          if ($.trim(that._getDialCode(value) + that.options.dcDelimiter) == value) {
            that.telInput.val("");
          }
        }
      });

      // made the decision not to trigger blur() now, because would only 
      // do anything in the case where they manually set the initial value to
      // just a dial code, in which case they probably want it to be displayed.
    },


    _showDropdown: function() {
      // update highlighting and scroll to active list item
      var activeListItem = this.countryList.children(".active");
      this._highlightListItem(activeListItem);

      // show it
      this.countryList.removeClass("hide");
      this._scrollTo(activeListItem);

      // bind all the dropdown-related listeners: mouseover, click, click-off, keydown
      this._bindDropdownListeners();

      // update the arrow
      this.selectedFlagInner.children(".arrow").addClass("up");
    },


    _bindDropdownListeners: function() {
      var that = this;

      // when mouse over a list item, just highlight that one
      // we add the class "highlight", so if they hit "enter" we know which one to select
      this.countryList.on("mouseover.intlTelInput", ".country", function(e) {
        that._highlightListItem($(this));
      });

      // listen for country selection
      this.countryList.on("click.intlTelInput", ".country", function(e) {
        that._selectListItem($(this));
      });

      // click off to close
      // (except when this initial opening click is bubbling up)
      // we cannot just stopPropagation as it may be needed to close another instance
      var isOpening = true;
      $('html').on("click.intlTelInput" + this.id, function(e) {
        if (!isOpening) {
          that._closeDropdown();
        }
        isOpening = false;
      });

      // listen for typing
      $(document).on("keydown.intlTelInput" + this.id, function(e) {
        // prevent down key from scrolling the whole page,
        // and enter key from submitting a form etc
        e.preventDefault();

        if (e.which == keys.UP || e.which == keys.DOWN) {
          // up and down to navigate
          that._handleUpDownKey(e.which);
        } else if (e.which == keys.ENTER) {
          // enter to select
          that._handleEnterKey();
        } else if (e.which == keys.ESCAPE) {
          // esc to close
          that._closeDropdown();
        } else if (e.which >= keys.A && e.which <= keys.Z) {
          // upper case letters (note: keyup/keydown only return upper case letters)
          // cycle through countries beginning with that letter
          that._handleLetterKey(e.which);
        }
      });
    },


    _handleUpDownKey: function(key) {
      var current = this.countryList.children(".highlight").first();
      var next = (key == keys.UP) ? current.prev() : current.next();
      if (next.length) {
        // skip the divider
        if (next.hasClass("divider")) {
          next = (key == keys.UP) ? next.prev() : next.next();
        }
        this._highlightListItem(next);
        this._scrollTo(next);
      }
    },


    _handleEnterKey: function() {
      var currentCountry = this.countryList.children(".highlight").first();
      if (currentCountry.length) {
        this._selectListItem(currentCountry);
      }
    },


    _handleLetterKey: function(key) {
      var letter = String.fromCharCode(key);
      // filter out the countries beginning with that letter
      var countries = this.countryListItems.filter(function() {
        return ($(this).text().charAt(0) == letter && !$(this).hasClass("preferred"));
      });

      if (countries.length) {
        // if one is already highlighted, then we want the next one
        var highlightedCountry = countries.filter(".highlight").first(),
          listItem;
        // if the next country in the list also starts with that letter
        if (highlightedCountry && highlightedCountry.next() && highlightedCountry.next().text().charAt(0) == letter) {
          listItem = highlightedCountry.next();
        } else {
          listItem = countries.first();
        }
        // update highlighting and scroll
        this._highlightListItem(listItem);
        this._scrollTo(listItem);
      }
    },


     // update the selected flag using the input's current value
    _updateFlagFromInputVal: function() {
      var that = this,
        countryCode,
        alreadySelected = false;

      // try and extract valid dial code from input
      var dialCode = this._getDialCode(this.telInput.val());
      if (dialCode) {
        // check if one of the matching countries is already selected
        var countryCodes = intlData.countryCodes[dialCode.replace(/\D/g, '')];
        $.each(countryCodes, function(i, c) {
          if (that.selectedFlagInner.hasClass(c)) {
            alreadySelected = true;
          }
        });
        countryCode = countryCodes[0];
      } else {
        // else default to dialcode of the first preferred country
        countryCode = this.defaultCountry.cca2;
      }

      if (!alreadySelected) {
        this._selectFlag(countryCode);
      }
    },


    // reset the input value to just a dial code
    _resetToDialCode: function(dialCode) {
      // if the dialCode is for America, and americaMode is enabled, then don't insert the dial code
      var value = (dialCode == "1" && this.options.americaMode) ? "" : "+" + dialCode + this.options.dcDelimiter;
      this.telInput.val(value);
    },


     // remove highlighting from other list items and highlight the given item
    _highlightListItem: function(listItem) {
      this.countryListItems.removeClass("highlight");
      listItem.addClass("highlight");
    },


    // find the country data for the given country code
    // the ignoreOnlyCountriesOption is only used during init() while parsing the onlyCountries array
    _getCountryData: function(countryCode, ignoreOnlyCountriesOption) {
      var countryList = (ignoreOnlyCountriesOption) ? intlDataFull.countries : intlData.countries;
      for (var i = 0; i < countryList.length; i++) {
        if (countryList[i].cca2 == countryCode) {
          return countryList[i];
        }
      }
      return null;
    },


    // update the selected flag and the active list item
    _selectFlag: function(countryCode) {
      this.selectedFlagInner.attr("class", "flag " + countryCode);

      // and update the active list item
      var listItem = this.countryListItems.children(".flag." + countryCode).parent();
      this.countryListItems.removeClass("active");
      listItem.addClass("active");
    },


    // called when the user selects a list item from the dropdown
    _selectListItem: function(listItem) {
      // update selected flag and active list item
      var countryCode = listItem.attr("data-country-code");
      this._selectFlag(countryCode);
      this._closeDropdown();

      // update input value
      var newNumber = this._updateNumber("+" + listItem.attr("data-dial-code"));
      this.telInput.val(newNumber);
      this.telInput.trigger("change");

      // focus the input
      this.telInput.focus();
    },


    // close the dropdown and unbind any listeners
    _closeDropdown: function() {
      this.countryList.addClass("hide");

      // update the arrow
      this.selectedFlagInner.children(".arrow").removeClass("up");

      // unbind event listeners
      $(document).off("keydown.intlTelInput" + this.id);
      $('html').off("click.intlTelInput" + this.id);
      // unbind both hover and click listeners
      this.countryList.off(".intlTelInput");
    },


    // check if an element is visible within it's container, else scroll until it is
    _scrollTo: function(element) {
      var container = this.countryList,
        containerHeight = container.height(),
        containerTop = container.offset().top,
        containerBottom = containerTop + containerHeight,
        elementHeight = element.outerHeight(),
        elementTop = element.offset().top,
        elementBottom = elementTop + elementHeight,
        newScrollTop = elementTop - containerTop + container.scrollTop();

      if (elementTop < containerTop) {
        // scroll up
        container.scrollTop(newScrollTop);
      } else if (elementBottom > containerBottom) {
        // scroll down
        var heightDifference = containerHeight - elementHeight;
        container.scrollTop(newScrollTop - heightDifference);
      }
    },


    // replace any existing dial code with the new one
    _updateNumber: function(newDialCode) {
      var inputVal = this.telInput.val(),
        prevDialCode = this._getDialCode(inputVal),
        newNumber;

      // if the previous number contained a valid dial code, replace it
      // (if more than just a plus character)
      if (prevDialCode.length > 1) {
        newNumber = inputVal.replace(prevDialCode, newDialCode);
        // if the old number was just the dial code,
        // then we will need to add the space again
        if (inputVal == prevDialCode) {
          newNumber += this.options.dcDelimiter;
        }
      } else if (inputVal.length && inputVal.substr(0, 1) != "+") {
        // previous number didn't contain a dial code, so persist it
        newNumber = newDialCode + this.options.dcDelimiter + $.trim(inputVal);
      } else {
        // previous number contained an invalid dial code, so wipe it
        newNumber = newDialCode + this.options.dcDelimiter;
      }

      // if americaMode is enabled, we dont display the dial code for american numbers
      if (this.options.americaMode && newNumber.substring(0, 3) == "+1"+this.options.dcDelimiter) {
        newNumber = newNumber.substring(3);
      }
      return newNumber;
    },


    // try and extract a valid international dial code from a full telephone number
    // Note: returns the raw string inc plus character and any whitespace/dots etc
    _getDialCode: function(inputVal) {
      var dialCode = "";
      inputVal = $.trim(inputVal);
      // only interested in international numbers (starting with a plus)
      if (inputVal.charAt(0) == "+") {
        var numericChars = "";
        // iterate over chars
        for (var i = 0; i < inputVal.length; i++) {
          var c = inputVal.charAt(i);
          // if char is number
          if ($.isNumeric(c)) {
            numericChars += c;
            // if current numericChars make a valid dial code
            if (intlData.countryCodes[numericChars]) {
              // store the actual raw string (useful for matching later)
              dialCode = inputVal.substring(0, i+1);
            }
            // longest dial code is 4 chars
            if (numericChars.length == 4) {
              break;
            }
          }
        }
      }
      return dialCode;
    },


    // add a country <li> to the countryList <ul> container
    _appendListItems: function(countries, className) {
      // we create so many DOM elements, I decided it was faster to build a temp string
      // and then add everything to the DOM in one go at the end
      var tmp = "";
      // for each country
      $.each(countries, function(i, c) {
        // open the list item
        tmp += "<li class='country " + className + "' data-dial-code='" + c['calling-code'] + "' data-country-code='" + c.cca2 + "'>";
        // add the flag
        tmp += "<div class='flag " + c.cca2 + "'></div>";
        // and the country name and dial code
        tmp += "<span class='country-name'>" + c.name + "</span>";
        tmp += "<span class='dial-code'>+" + c['calling-code'] + "</span>";
        // close the list item
        tmp += "</li>";
      });
      this.countryList.append(tmp);
    },






    /********************
     *  PUBLIC METHODS
     ********************/


    // set the input value and update the flag
    setNumber: function(number) {
      this.telInput.val(number);
      this._updateFlagFromInputVal();
    },


    // update the selected flag, and insert the dial code
    selectCountry: function(countryCode) {
      // check if already selected
      if (!this.selectedFlagInner.hasClass(countryCode)) {
        this._selectFlag(countryCode);
        if (!this.options.autoHideDialCode) {
          var countryData = this._getCountryData(countryCode, false);
          this._resetToDialCode(countryData["calling-code"]);
        }
      }
    }

  };





  // adapted to allow public functions
  // using https://github.com/jquery-boilerplate/jquery-boilerplate/wiki/Extending-jQuery-Boilerplate
  $.fn[pluginName] = function(options) {
    var args = arguments;

    // Is the first parameter an object (options), or was omitted,
    // instantiate a new instance of the plugin.
    if (options === undefined || typeof options === 'object') {
      return this.each(function() {
        if (!$.data(this, "plugin_" + pluginName)) {
          $.data(this, "plugin_" + pluginName, new Plugin(this, options));
        }
      });
    } else if (typeof options === 'string' && options[0] !== '_' && options !== 'init') {
      // If the first parameter is a string and it doesn't start
      // with an underscore or "contains" the `init`-function,
      // treat this as a call to a public method.

      // Cache the method call to make it possible to return a value
      var returns;

      this.each(function() {
        var instance = $.data(this, 'plugin_' + pluginName);

        // Tests that there's already a plugin-instance
        // and checks that the requested public method exists
        if (instance instanceof Plugin && typeof instance[options] === 'function') {
          // Call the method of our plugin instance,
          // and pass it the supplied arguments.
          returns = instance[options].apply(instance, Array.prototype.slice.call(args, 1));
        }
      });

      // If the earlier cached method gives a value back return the value,
      // otherwise return this to preserve chainability.
      return returns !== undefined ? returns : this;
    }
  };





  /********************
   *  STATIC METHODS
   ********************/


  // get the country data object
  $.fn[pluginName].getCountryData = function() {
    return intlDataFull;
  };


  // set the country data object
  $.fn[pluginName].setCountryData = function(obj) {
    intlDataFull = obj;
  };


