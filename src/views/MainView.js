(function (window, console, Encryptr, undefined) {
  "use strict";
  console       = console || {};
  console.log   = console.log || function() {};
  var Backbone  = window.Backbone,
    _         = window._,
    $         = window.Zepto;

  var MainView = Backbone.View.extend({
    el: "#main",
    events: {
      "click .menu-btn": "menuButton_clickHandler",
      "click .export-btn": "exportButton_clickHandler",
      "click .share-btn": "shareButton_clickHandler",
      "click .copy-btn": "copyButton_clickHandler",
      "click .back-btn": "backButton_clickHandler",
      "click .edit-btn": "editButton_clickHandler",
      "click .save-btn": "saveButton_clickHandler",
      "click .delete-btn": "deleteButton_clickHandler",
      "click .add-btn": "addButton_clickHandler",
      "click .nav": "menuClose_clickHandler",
      "click .subviews": "menuClose_clickHandler"
    },
    initialize: function(options) {
      _.bindAll(this,
          "menuButton_clickHandler",
          "exportButton_clickHandler",
          "shareButton_clickHandler",
          "copyButton_clickHandler",
          "backButton_clickHandler",
          "addButton_clickHandler",
          "saveButton_clickHandler",
          "editButton_clickHandler",
          "deleteButton_clickHandler",
          "backButtonDisplay"
      );
      app.checkonline(['.add-btn', '.fab.add-btn']);
      this.updatedLocalStorage = false;
      this.menuView = new Encryptr.prototype.MenuView().render();
      this.menuView.dismiss();
      this.addMenuView = new Encryptr.prototype.AddMenuView().render();
      this.addMenuView.dismiss();
      if (!$(".menu").length) this.$el.append(this.menuView.el);
      if (!$(".addMenu").length) this.$el.append(this.addMenuView.el);
      if ($.os.ios || $.os.android || $.os.bb10) {
        $('.nav .share-btn').removeClass('hidden');
        $('.nav .copy-btn').removeClass('hidden');
      } else {
        $('.nav .export-btn').removeClass('hidden');
      }
    },
    render: function() {
      this.$(".nav").html(
        window.tmpl["navView"]({})
      );
      if (!window.app.toastView) {
        window.app.toastView = new window.app.ToastView();
      }
      if ($.os.nodeWebkit) {
        $('.fab').css({visibility: "hidden"});
        $('.nav .export-btn.right').addClass('right2');
        $('.nav .export-btn').addClass('disabled-link disabled-btn');
      } else {
        $('.nav .add-btn.right').addClass('shrunken');
        $('.fab.add-btn').on('click', this.addButton_clickHandler);
        $('.nav .share-btn').addClass('disabled-link disabled-btn');
        $('.nav .copy-btn').addClass('disabled-link disabled-btn');
      }
      return this;
    },
    saveLocalStorage: function(onlySession){
      var self = this;
      onlySession = (onlySession) ? onlySession : false;
      var data = window.sessionStorage.getItem('crypton');
      if (onlySession) {
        data = JSON.stringify({Session: JSON.parse(data).Session});
      }
      window.app.mainView.updatedLocalStorage = true;
      if ($.os.ios || $.os.android || $.os.bb10) {
        $('.nav .share-btn').removeClass('disabled-link disabled-btn');
        $('.nav .copy-btn').removeClass('disabled-link disabled-btn');
        return self.saveOfflineDataCordova('encrypt.data', data);
      } else if ($.os.nodeWebkit) {
        if ($.os.nodeWebkit) {
          $('.nav .export-btn').removeClass('disabled-link disabled-btn');
          return self.saveOfflineDataInDesktop('encrypt.data', data);
        }
      }
    },
    updateLocalStorage: function() {
      var self = this;
      if (!this.updatedLocalStorage) {
        return this.getEntries().then(self.saveLocalStorage.bind(self), function(){
          if (window.app.entriesCollection.length === 0) {
            self.saveLocalStorage(true);
          }
        });
      }
    },
    menuButton_clickHandler: function(event) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      $('.nav .menu-btn').addClass('hidden');
      if ($.os.ios || $.os.android || $.os.bb10) {
        $('.nav .share-btn').addClass('hidden');
        $('.nav .copy-btn').addClass('hidden');
      } else {
        $('.nav .export-btn').addClass('hidden');
      }
      $(".fab").addClass("shrunken");
      window.app.navigator.pushView(window.app.SettingsView, {},
        window.app.defaultEffect);
    },
    addFieldFromEntry: function(entry, fields){
      entry.items.forEach(function(item) {
        var field = item.key;
        if (fields.indexOf(field) === -1) {
          fields.push(field);
        }
      });
    },
    getCsvFields: function(entries) {
      var fields = ['Entry Type', 'Label'];
      for (var index in entries){
        var entry = entries[index];
        this.addFieldFromEntry(entry, fields);
      }
      return fields;
    },
    addDataFromEntry: function(entry, fields){
      var entry_data = {};
      entry.items.forEach(function(item) {
        var field = item.key;
        entry_data[field] = item.value;
      });
      entry_data['Entry Type'] = entry.type;
      entry_data['Label'] = entry.label;
      return entry_data;
    },
    getCsvData: function(entries, fields) {
      var data = [];
      for (var index in entries){
        var entry = entries[index];
        data.push(this.addDataFromEntry(entry, fields));
      }
      return data;
    },
    writeCordovaFile: function(directory, fileName, data){
      var promise = $.Deferred();
      window.resolveLocalFileSystemURL(directory, function (directoryEntry) {
          directoryEntry.getFile(fileName, { create: true }, function (fileEntry) {
              fileEntry.createWriter(function (fileWriter) {
                  var blob = new Blob([data], { type: 'text/csv' });
                  fileWriter.write(blob);
                  promise.resolve(fileEntry.fullPath);
              }, promise.reject);
          }, promise.reject);
      }, promise.reject);
      return promise;
    },
    saveOfflineDataCordova: function(file, data){
      return this.writeCordovaFile(cordova.file.dataDirectory, file, data);
    },
    saveOfflineDataInDesktop: function(file, data){
      var nw = require('nw.gui');
      var fs = require('fs');
      var path = require('path');
      var promise = $.Deferred();
      var filePath = path.join(nw.App.dataPath, file);
      fs.writeFile(filePath, data, function (err) {
        if (err) {
          console.info("There was an error attempting to save your data.");
          console.warn(err.message);
          promise.resolve(err);
          return;
        }
        promise.resolve(filePath);
      });
      return promise;
    },
    saveCsv: function(csv){
      /**
       * This method (use a.download) works in all browser and all node-webkit version
       * Read documentation: https://www.w3schools.com/tags/att_a_download.asp
       */
      var type = 'text/csv';
      var file = new Blob([csv], {type: type});
      var a = document.createElement("a");
      var url = window.URL.createObjectURL(file);
      a.href = url;
      a.target="_blank";
      a.download = 'export.csv';
      a.hidden = true;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    },
    generateCsvFromEntries: function(entries) {
      var fields = this.getCsvFields(entries);
      var data = this.getCsvData(entries, fields);
      var csv = json2csv({'data': data, 'fields': fields});
      return csv;
    },
    getEntry: function (entry) {
      var entry_model = new window.app.EntryModel(entry);
      var promise = $.Deferred();
      entry_model.fetch({
        success: function(_, resp){
          promise.resolve(resp);
        },
        error: promise.reject
      });
      return promise;
    },
    getEntries: function() {
      var self = this;
      return window.app.entriesView.getCollection().then(function(collection) {
        var promise = $.Deferred();
        if (collection) {
          var promises = collection.map(self.getEntry);
          return $.when.apply($, promises);
        }
        promise.reject();
        return promise;
      });
    },
    getCsv: function() {
     var self = this;
     $(".entriesViewLoading").text("Generating CSV file...");
     $(".entriesViewLoading").addClass("loadingEntries");
     return this.getEntries().then(function(){
      var entries = arguments;
      $(".entriesViewLoading").removeClass("loadingEntries");
      return self.generateCsvFromEntries(entries);
     });
    },
    exportButton_clickHandler: function(event) {
      var self = this;
      event.stopPropagation();
      event.stopImmediatePropagation();
      return this.getCsv().then(function (csv){
        self.saveCsv(csv);
      });
    },
    shareButton_clickHandler: function(event) {
      var self = this;
      event.stopPropagation();
      event.stopImmediatePropagation();
      return this.getCsv().then(function (csv) {
        csv = JSON.stringify(csv, null, '\t');
        return self.writeCordovaFile(cordova.file.cacheDirectory, 'export.csv', csv);
      }).then(function(filePath) {
        var options = {
          message: 'Encryptr csv with entries data',
          files: [cordova.file.cacheDirectory + filePath],
          subject: 'Encryptr data'
        };
        window.plugins.socialsharing.shareWithOptions(options);
      });
    },
    copyButton_clickHandler: function(event) {
      var self = this;
      event.stopPropagation();
      event.stopImmediatePropagation();
      return this.getCsv().then(function (csv){
        cordova.plugins.clipboard.copy(csv);
        window.app.toastView.show("The entries were successfully copied in clipboard");
      });
    },
    backButton_clickHandler: function(event) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      var _this = this;
      if (window.app.navigator.activeView.confirmBackNav) {
        window.app.dialogConfirmView.show(window.app.navigator.activeView.confirmBackNav,
            function(event) {
              if (event.type === "dialogAccept") {
                _this.backButtonDisplay(false);
                if (window.app.navigator.viewsStack.length > 1) {
                  window.app.navigator.popView(window.app.defaultPopEffect);
                }
                window.app.navigator.activeView.confirmBackNav.callback();
              }
            });
      } else {
        //_this.backButtonDisplay(false);
        this.$(".back-btn").addClass("hidden");
        if (window.app.navigator.viewsStack.length > 1) {
          window.app.navigator.popView(window.app.defaultPopEffect);
        }
      }
    },
    addButton_clickHandler: function(event) {
      event.preventDefault();
      this.addMenuView.toggle();
    },
    editButton_clickHandler: function(event) {
      this.trigger("editentry");
    },
    saveButton_clickHandler: function(event) {
      this.trigger("saveentry");
    },
    deleteButton_clickHandler: function(event) {
      this.trigger("deleteentry");
    },
    setTitle: function(title) {
      if (title === "Encryptr") {
        this.$('.nav .title .text-gradient')
          .html('<img src="img/LogoColoured.svg" style="height: 32px; padding: 12px 0;">');
      } else {
        this.$(".nav .title .text-gradient").text(title);
      }
    },
    backButtonDisplay: function(show) {
      if (show) {
        this.$(".back-btn").removeClass("hidden");
        this.$(".menu-btn").addClass("hidden");
        if ($.os.ios || $.os.android || $.os.bb10) {
          $('.nav .share-btn').addClass('hidden');
          $('.nav .copy-btn').addClass('hidden');
        } else {
          $('.nav .export-btn').addClass('hidden');
        }
        return;
      }
      this.$(".back-btn").addClass("hidden");
      this.$(".menu-btn").removeClass("hidden");
      if ($.os.ios || $.os.android || $.os.bb10) {
        $('.nav .share-btn').removeClass('hidden');
        $('.nav .copy-btn').removeClass('hidden');
      } else {
        $('.nav .export-btn').removeClass('hidden');
      }
    },
    cancelDialogButton_clickHandler: function(event) {
      // ...
    },
    acceptDialogButton_clickHandler: function(event) {
      // ...
    },
    menuClose_clickHandler: function(event) {
      if (!this.menuView.$el.hasClass("dismissed") &&
          !$(event.target).hasClass("fa-ellipsis-v") &&
          !$(event.target).hasClass("menu-btn")) {
        this.menuView.dismiss();
      }
      if (!this.addMenuView.$el.hasClass("dismissed") &&
          !$(event.target).hasClass("fa-plus") &&
          !$(event.target).hasClass("add-btn")) {
        this.addMenuView.dismiss();
      }
    },
    close: function() {
      this.menuView.close();
      this.addMenuView.close();
      $('.add-btn').off('click', this.addButton_clickHandler);
    }
  });

  Encryptr.prototype.MainView = MainView;

})(this, this.console, this.Encryptr);
