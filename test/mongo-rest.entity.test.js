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
            params: {
              resource: 'user'
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

      mongoRest = new MongoRest({ }, { viewPath: 'resource_views/', viewPrefix: 'my_lovely_resource_' }, true); // Don't register routes
      mongoRest.renderEntity(doc, req, res, next);

      (sentDoc === null).should.be.true;
      renderedView.should.eql("resource_views/my_lovely_resource_user_show");
      renderedInfo.should.eql({ doc: doc, site: 'user-show' });



      // Set enableXhr to true
      sentDoc = renderedView = renderedInfo = null;

      mongoRest = new MongoRest({ }, { enableXhr: true, viewPath: 'resource_views/', viewPrefix: 'my_lovely_resource_' }, true); // Don't register routes
      mongoRest.renderEntity(doc, req, res, next);

      sentDoc.should.eql({ doc: doc });
      (renderedView === null).should.be.true;
      (renderedInfo === null).should.be.true;


      // Set enableXhr to true but the request is not xhr.
      sentDoc = renderedView = renderedInfo = null;

      mongoRest = new MongoRest({ }, { viewPath: 'resource_views/', viewPrefix: 'my_lovely_resource_' }, true); // Don't register routes
      req.xhr = false;
      mongoRest.renderEntity(doc, req, res, next);

      (sentDoc === null).should.be.true;
      renderedView.should.eql("resource_views/my_lovely_resource_user_show");
      renderedInfo.should.eql({ doc: doc, site: 'user-show' });

    });
  });


  describe('entityGet()', function() {
    var mongoRest = new MongoRest({ }, null, true) // Don't register routes
      , req = { model: { }, doc: new function() { this.doc = true; }, params: { resource: 'user' } };

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


  describe("entityPut()", function() {
    it("should call the 'put' event interceptors");
    it("should call the 'put.success' event interceptors on success");
    it("should call the 'put.error' event interceptors on error");
  });


  describe("entityDelete()", function() {
    it("should call the 'delete' event interceptors");
    it("should call the 'delete.success' event interceptors on success");
    it("should call the 'delete.error' event interceptors on error");
    it("should call next with the error on error");
  });

});