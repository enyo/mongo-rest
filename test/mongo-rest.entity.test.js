var MongoRest = require('../src/index')
  , _ = require('underscore')
;

describe('MongoRest', function() {

  describe("renderEntity()", function() {
    it('should render an entity correctly depending on the request', function() {
      var sentDoc;
      var renderedView, renderedInfo;

      var mongoRest
        , req = {
            xhr: true,
            resource: {
              singularName: 'user',
              pluralName: 'users',
              model: function() { },
              enableXhr: false,
              entityViewTemplate: "resource_views/my_lovely_resource_user_show",
              entityDataName: 'user_doc',
              collectionDataName: 'users_docs'
            },
            params: {
              resourceName: 'user'
            }
          }
        , res = {
              send: function(doc) { sentDoc = doc }
            , render: function(view, info) { renderedView = view; renderedInfo = info; }
          }
        , next = function() { }
        , doc = new function() { this.doc = true; var self = this; this.toObject = function() { return self }; }
        ;



      // enableXhr is false by default.
      sentDoc = renderedView = renderedInfo = null;

      req.resource.enableXhr = false;
      mongoRest = new MongoRest({ }, { entityViewTemplate: "resource_views/my_lovely_resource_{{singularName}}_show" }, true); // Don't register routes
      mongoRest.renderEntity(doc, req, res, next);

      (sentDoc === null).should.be.true;
      renderedView.should.eql("resource_views/my_lovely_resource_user_show");
      renderedInfo.should.eql({ user_doc: doc, site: 'user-show' });



      // Set enableXhr to true
      sentDoc = renderedView = renderedInfo = null;

      req.resource.enableXhr = true;
      mongoRest = new MongoRest({ }, { }, true); // Don't register routes
      mongoRest.renderEntity(doc, req, res, next);

      sentDoc.should.eql({ user_doc: doc });
      (renderedView === null).should.be.true;
      (renderedInfo === null).should.be.true;


      // Set enableXhr to true but the request is not xhr.
      sentDoc = renderedView = renderedInfo = null;

      mongoRest = new MongoRest({ }, { entityViewTemplate: "resource_views/my_lovely_resource_{{singularName}}_show" }, true); // Don't register routes
      req.xhr = false;
      mongoRest.renderEntity(doc, req, res, next);

      (sentDoc === null).should.be.true;
      renderedView.should.eql("resource_views/my_lovely_resource_user_show");
      renderedInfo.should.eql({ user_doc: doc, site: 'user-show' });

    });
  });


  describe('entityGet()', function() {
    var mongoRest = new MongoRest({ }, null, true) // Don't register routes
      , req = { resource: { singularName: "user", pluralName: "users" }, doc: new function() { this.doc = true; }, params: { resourceName: 'user' } };

    mongoRest.addResource("user", { });

    it("should directly render if there are no interceptors", function(done) {
      mongoRest.renderEntity = function(doc) {
        doc.should.equal(req.doc);
        done();
      };

      var route = mongoRest.entityGet();
      route(req, { }, { });
    });
    it("should call all interceptors and render the entity asynchroniously", function(done) {
      var interceptedCount = 0
        , interceptor = function(info, iDone) {
            interceptedCount ++;
            info.doc.should.equal(req.doc);
            setTimeout(function() { iDone(); }, 1);
          }
      ;

      mongoRest.addInterceptor("user", "get", interceptor);
      mongoRest.addInterceptor("user", "get", interceptor);
      mongoRest.addInterceptor("user", "get", interceptor);

      var route = mongoRest.entityGet();

      mongoRest.renderEntity = function(doc) {
        interceptedCount.should.equal(3);
        doc.should.equal(req.doc);
        done();
      };

      route(req, { }, { });
    });
    it("should call all interceptors and render the entity synchroniously", function(done) {
      var interceptedCount = 0
        , interceptor = function(info, iDone) {
            interceptedCount ++;
            info.doc.should.equal(req.doc);
            iDone();
          }
      ;

      mongoRest.addInterceptor("user", "get", interceptor);
      mongoRest.addInterceptor("user", "get", interceptor);
      mongoRest.addInterceptor("user", "get", interceptor);

      var route = mongoRest.entityGet();

      mongoRest.renderEntity = function(doc) {
        interceptedCount.should.equal(3);
        doc.should.equal(req.doc);
        done();
      };

      route(req, { }, { });
    });
  });

  describe("modification functions", function() {
    var mongoRest
      , error
      , req = {
          body: { newResource: { some: 'values' } }
        , doc: {
            _id: 12345,
            save: function(callback) { setTimeout(function() { callback(error); }, 1); },
            remove: function(callback) { setTimeout(function() { callback(error); }, 1); }
          }
        , resource: { singularName: 'user', pluralName: 'users', model: function() { throw new Error(); }, entityViewTemplate: "bla", collectionViewTemplate: "bla", singleView: true, entityDataName: 'doc', collectionDataName: 'docs' }
        , params: { resourceName: 'user' }
      }
      ;

    beforeEach(function() {
      mongoRest = new MongoRest({ }, null, true); // Don't register routes
      mongoRest.addResource("user", { });
    });


    describe("entityPut()", function() {
      it("should call the 'put' and 'put.success' event interceptors on success", function(done) {
        error = null;
        var flashs = [];
        mongoRest.flash = function(type, message) { flashs.push([type, message]) };

        var interceptorList = []
          , interceptor = function(intName) { return function(info, iDone) { interceptorList.push(intName); setTimeout(iDone, 1); } }
          ;

        mongoRest.addInterceptor("user", "put", interceptor("firstPut"));
        mongoRest.addInterceptor("user", "put", interceptor("secondPut"));
        mongoRest.addInterceptor("user", "put.success", interceptor("put.success"));
        mongoRest.addInterceptor("user", "put.error", interceptor("put.error"));

        var res = {
          redirect: function(address) {
            address.should.equal("/user/12345");
            flashs.should.eql([ [ 'success', 'Successfully updated the record.' ] ]);
            interceptorList.should.eql([ "firstPut", "secondPut", "put.success" ]);
            done();
          }
        };

        mongoRest.entityPut()(req, res, { });

      });
      it("should call the 'put.error' event interceptors on error", function(done) {
        error = new Error("Something went wrong1");
        mongoRest.flash = function(type, message) { false.should.be.true; }; // Should not happen.

        var interceptorList = []
          , interceptor = function(intName) { return function(info, iDone) { interceptorList.push(intName); setTimeout(iDone, 1); } }
          ;

        mongoRest.addInterceptor("user", "put", interceptor("firstPut"));
        mongoRest.addInterceptor("user", "put", interceptor("secondPut"));
        mongoRest.addInterceptor("user", "put.success", interceptor("put.success"));
        mongoRest.addInterceptor("user", "put.error", interceptor("put.error"));

        mongoRest.renderError = function(err, address, req, res, next) {
          err.message.should.equal("Unable to save the record: Something went wrong1");
          address.should.equal("/user/12345");
          interceptorList.should.eql([ "firstPut", "secondPut", "put.error" ]);
          done();
        }

        mongoRest.entityPut()(req, { }, { });

      });
      it("should call the 'put.error' event interceptors if the 'put' interceptor errors", function(done) {
        error = null;
        mongoRest.flash = function(type, message) { false.should.be.true; }; // Should not happen.

        var interceptorList = []
          , interceptor = function(intName) { return function(info, iDone) { interceptorList.push(intName); setTimeout(iDone, 1); } }
          ;

        mongoRest.addInterceptor("user", "put", interceptor("firstPut"));
        mongoRest.addInterceptor("user", "put", function(info, iDone) { iDone(new Error("interceptor error")); });
        mongoRest.addInterceptor("user", "put", interceptor("secondPut"));
        mongoRest.addInterceptor("user", "put.success", interceptor("put.success"));
        mongoRest.addInterceptor("user", "put.error", interceptor("put.error"));

        mongoRest.renderError = function(err, address, req, res, next) {
          err.message.should.equal("Unable to save the record: interceptor error");
          address.should.equal("/user/12345");
          interceptorList.should.eql([ "firstPut", "put.error" ]);
          done();
        }

        mongoRest.entityPut()(req, { }, { });

      });
      it("should call the 'put.error' event interceptors if the put.success interceptor errors", function(done) {
        error = null;
        mongoRest.flash = function(type, message) { false.should.be.true; }; // Should not happen.

        var interceptorList = []
          , interceptor = function(intName) { return function(info, iDone) { interceptorList.push(intName); setTimeout(iDone, 1); } }
          ;

        mongoRest.addInterceptor("user", "put", interceptor("firstPut"));
        mongoRest.addInterceptor("user", "put", interceptor("secondPut"));
        mongoRest.addInterceptor("user", "put.success", interceptor("put.success"));
        mongoRest.addInterceptor("user", "put.error", interceptor("put.error"));
        mongoRest.addInterceptor("user", "put.success", function(info, iDone) {
          iDone(new Error("interceptor error"));
        });

        mongoRest.renderError = function(err, address, req, res, next) {
          err.message.should.equal("Unable to save the record: interceptor error");
          address.should.equal("/user/12345");
          interceptorList.should.eql([ "firstPut", "secondPut", "put.success", "put.error" ]);
          done();
        }

        mongoRest.entityPut()(req, { }, { });

      });
    });


    describe("entityDelete()", function() {
      it("should call the 'delete' and 'delete.success' event interceptors on success", function(done) {
        error = null;
        var flashs = [];
        mongoRest.flash = function(type, message) { flashs.push([type, message]) };

        var interceptorList = []
          , interceptor = function(intName) { return function(info, iDone) { interceptorList.push(intName); setTimeout(iDone, 1); } }
          ;

        mongoRest.addInterceptor("user", "delete", interceptor("firstPut"));
        mongoRest.addInterceptor("user", "delete", interceptor("secondDelete"));
        mongoRest.addInterceptor("user", "delete.success", interceptor("delete.success"));
        mongoRest.addInterceptor("user", "delete.error", interceptor("delete.error"));

        var res = {
          redirect: function(address) {
            address.should.equal("/users");
            flashs.should.eql([ [ 'success', 'Successfully deleted the record.' ] ]);
            interceptorList.should.eql([ "firstPut", "secondDelete", "delete.success" ]);
            done();
          }
        };

        mongoRest.entityDelete()(req, res, { });

      });
      it("should call the 'delete.error' event interceptors on error", function(done) {
        error = new Error("Something went wrong2");
        mongoRest.flash = function(type, message) { true.should.be.false; };

        var interceptorList = []
          , interceptor = function(intName) { return function(info, iDone) { interceptorList.push(intName); setTimeout(iDone, 1); } }
          ;

        mongoRest.addInterceptor("user", "delete", interceptor("firstDelete"));
        mongoRest.addInterceptor("user", "delete", interceptor("secondDelete"));
        mongoRest.addInterceptor("user", "delete.success", interceptor("delete.success"));
        mongoRest.addInterceptor("user", "delete.error", interceptor("delete.error"));


        mongoRest.renderError = function(err, address, req, res, next) {
          err.message.should.equal("Unable to delete the record: Something went wrong2");
          address.should.equal("/users");
          interceptorList.should.eql([ "firstDelete", "secondDelete", "delete.error" ]);
          done();
        };


        mongoRest.entityDelete()(req, { }, { });

      });
      it("should call the 'delete.error' event interceptors if the 'delete' interceptors error", function(done) {
        error = null;
        mongoRest.flash = function(type, message) { true.should.be.false; };

        var interceptorList = []
          , interceptor = function(intName) { return function(info, iDone) { interceptorList.push(intName); setTimeout(iDone, 1); } }
          ;

        mongoRest.addInterceptor("user", "delete", interceptor("firstDelete"));
        mongoRest.addInterceptor("user", "delete", function(info, iDone) { iDone(new Error("interceptor error")); });
        mongoRest.addInterceptor("user", "delete", interceptor("secondDelete"));
        mongoRest.addInterceptor("user", "delete.success", interceptor("delete.success"));
        mongoRest.addInterceptor("user", "delete.error", interceptor("delete.error"));


        mongoRest.renderError = function(err, address, req, res, next) {
          err.message.should.equal("Unable to delete the record: interceptor error");
          address.should.equal("/users");
          interceptorList.should.eql([ "firstDelete", "delete.error" ]);
          done();
        };


        mongoRest.entityDelete()(req, { }, { });

      });
      it("should call the 'delete.error' event interceptors if the 'delete.success' interceptors error", function(done) {
        error = null;
        mongoRest.flash = function(type, message) { true.should.be.false; };

        var interceptorList = []
          , interceptor = function(intName) { return function(info, iDone) { interceptorList.push(intName); setTimeout(iDone, 1); } }
          ;

        mongoRest.addInterceptor("user", "delete", interceptor("firstDelete"));
        mongoRest.addInterceptor("user", "delete", interceptor("secondDelete"));
        mongoRest.addInterceptor("user", "delete.success", interceptor("delete.success"));
        mongoRest.addInterceptor("user", "delete.success", function(info, iDone) { iDone(new Error("interceptor error")); });
        mongoRest.addInterceptor("user", "delete.error", interceptor("delete.error"));


        mongoRest.renderError = function(err, address, req, res, next) {
          err.message.should.equal("Unable to delete the record: interceptor error");
          address.should.equal("/users");
          interceptorList.should.eql([ "firstDelete", "secondDelete", "delete.success", "delete.error" ]);
          done();
        };


        mongoRest.entityDelete()(req, { }, { });

      });
    });
  });

});