var MongoRest = require('../lib/index')
  , _ = require('underscore')
;

describe('MongoRest', function() {

  describe("renderEntity()", function() {
    it('should render a collection correctly depending on the request', function() {
      var sentDoc;
      var renderedView, renderedInfo;

      var mongoRest
        , req = {
            xhr: true,
            resource: {
              singularName: 'user',
              pluralName: 'users',
              model: function() { }
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
        , doc = new function() { this.doc = true }
        ;



      // enableXhr is false by default.
      sentDoc = renderedView = renderedInfo = null;

      mongoRest = new MongoRest({ }, { entityViewTemplate: "resource_views/my_lovely_resource_{{singularName}}_show" }, true); // Don't register routes
      mongoRest.renderEntity(doc, req, res, next);

      (sentDoc === null).should.be.true;
      renderedView.should.eql("resource_views/my_lovely_resource_user_show");
      renderedInfo.should.eql({ doc: doc, site: 'user-show' });



      // Set enableXhr to true
      sentDoc = renderedView = renderedInfo = null;

      mongoRest = new MongoRest({ }, { enableXhr: true, entityViewTemplate: "resource_views/my_lovely_resource_{{singularName}}_show" }, true); // Don't register routes
      mongoRest.renderEntity(doc, req, res, next);

      sentDoc.should.eql({ doc: doc });
      (renderedView === null).should.be.true;
      (renderedInfo === null).should.be.true;


      // Set enableXhr to true but the request is not xhr.
      sentDoc = renderedView = renderedInfo = null;

      mongoRest = new MongoRest({ }, { entityViewTemplate: "resource_views/my_lovely_resource_{{singularName}}_show" }, true); // Don't register routes
      req.xhr = false;
      mongoRest.renderEntity(doc, req, res, next);

      (sentDoc === null).should.be.true;
      renderedView.should.eql("resource_views/my_lovely_resource_user_show");
      renderedInfo.should.eql({ doc: doc, site: 'user-show' });

    });
  });


  describe('entityGet()', function() {
    var mongoRest = new MongoRest({ }, null, true) // Don't register routes
      , req = { resource: { }, doc: new function() { this.doc = true; }, params: { resourceName: 'user' } };

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
    var mongoRest = new MongoRest({ }, null, true) // Don't register routes
      , error
      , req = {
          body: { newResource: { some: 'values' } }
        , doc: {
            _id: 12345,
            save: function(callback) { setTimeout(function() { callback(error); }, 1); },
            remove: function(callback) { setTimeout(function() { callback(error); }, 1); }
          }
        , resource: { singularName: 'user', pluralName: 'users', model: function() { throw new Error(); } }
        , params: { resourceName: 'user' }
      }
      ;

    describe("entityPut()", function() {
      it("should call the 'put' and 'put.success' event interceptors on success", function(done) {
        error = null;
        var flashs = [];
        req.flash = function(type, message) { flashs.push([type, message]) };

        var interceptorList = []
          , interceptor = function(intName) { return function(info, iDone) { interceptorList.push(intName); setTimeout(iDone, 1); } }
          ;

        mongoRest.addInterceptor("user", "put", interceptor("firstPost"));
        mongoRest.addInterceptor("user", "put", interceptor("secondPost"));
        mongoRest.addInterceptor("user", "put.success", interceptor("put.success"));
        mongoRest.addInterceptor("user", "put.error", interceptor("put.error"));

        var res = {
          redirect: function(address) {
            address.should.equal("/user/12345");
            flashs.should.eql([ [ 'success', 'Successfully updated the record.' ] ]);
            interceptorList.should.eql([ "firstPost", "secondPost", "put.success" ]);
            done();
          }
        };

        mongoRest.entityPut()(req, res, { });

      });
      it("should call the 'put.error' event interceptors on error", function(done) {
        error = new Error("Something went wrong");
        var flashs = [];
        req.flash = function(type, message) { flashs.push([type, message]) };

        var interceptorList = []
          , interceptor = function(intName) { return function(info, iDone) { interceptorList.push(intName); setTimeout(iDone, 1); } }
          ;

        mongoRest.addInterceptor("user", "put", interceptor("firstPost"));
        mongoRest.addInterceptor("user", "put", interceptor("secondPost"));
        mongoRest.addInterceptor("user", "put.success", interceptor("put.success"));
        mongoRest.addInterceptor("user", "put.error", interceptor("put.error"));

        var res = {
          redirect: function(address) {
            address.should.equal("/user/12345");
            flashs.should.eql([ [ 'error', 'Unable to save the record: Something went wrong' ] ]);
            interceptorList.should.eql([ "firstPost", "secondPost", "put.error" ]);
            done();
          }
        };

        mongoRest.entityPut()(req, res, { });

      });
    });


    describe("entityDelete()", function() {
      it("should call the 'delete' and 'delete.success' event interceptors on success", function(done) {
        error = null;
        var flashs = [];
        req.flash = function(type, message) { flashs.push([type, message]) };

        var interceptorList = []
          , interceptor = function(intName) { return function(info, iDone) { interceptorList.push(intName); setTimeout(iDone, 1); } }
          ;

        mongoRest.addInterceptor("user", "delete", interceptor("firstPost"));
        mongoRest.addInterceptor("user", "delete", interceptor("secondPost"));
        mongoRest.addInterceptor("user", "delete.success", interceptor("delete.success"));
        mongoRest.addInterceptor("user", "delete.error", interceptor("delete.error"));

        var res = {
          redirect: function(address) {
            address.should.equal("/users");
            flashs.should.eql([ [ 'success', 'Successfully deleted the record.' ] ]);
            interceptorList.should.eql([ "firstPost", "secondPost", "delete.success" ]);
            done();
          }
        };

        mongoRest.entityDelete()(req, res, { });

      });
      it("should call the 'delete.error' event interceptors on error", function(done) {
        error = new Error("Something went wrong");
        var flashs = [];
        req.flash = function(type, message) { flashs.push([type, message]) };

        var interceptorList = []
          , interceptor = function(intName) { return function(info, iDone) { interceptorList.push(intName); setTimeout(iDone, 1); } }
          ;

        mongoRest.addInterceptor("user", "delete", interceptor("firstPost"));
        mongoRest.addInterceptor("user", "delete", interceptor("secondPost"));
        mongoRest.addInterceptor("user", "delete.success", interceptor("delete.success"));
        mongoRest.addInterceptor("user", "delete.error", interceptor("delete.error"));

        var res = {
          redirect: function(address) {
            address.should.equal("/users");
            flashs.should.eql([ [ 'error', 'Unable to delete the record: Something went wrong' ] ]);
            interceptorList.should.eql([ "firstPost", "secondPost", "delete.error" ]);
            done();
          }
        };

        mongoRest.entityDelete()(req, res, { });

      });
    });
  });

});