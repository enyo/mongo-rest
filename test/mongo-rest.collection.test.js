var MongoRest = require('../src/index')
  , _ = require('underscore')
;

describe('MongoRest', function() {

  describe("renderCollection()", function() {
    it('should render a collection correctly depending on the request', function() {
      var sentDocs;
      var renderedView, renderedInfo;

      var mongoRest
        , req = {
            xhr: true,
            resource: { enableXhr: true, singularName: 'user', pluralName: 'users', model: { }, entityViewTemplate: 'resources/user', collectionViewTemplate: 'resources/users', entityDataName: 'doc', collectionDataName: 'docs' },
            params: {
              resourceName: 'user'
            }
          }
        , res = {
              send: function(docs) { sentDocs = docs }
            , render: function(view, info) { renderedView = view; renderedInfo = info; }
          }
        , next = function() { }
        , doc1 = new function() { this.doc1 = true; var self = this; this.toObject = function() { return self }; }
        , doc2 = new function() { this.doc2 = true; var self = this; this.toObject = function() { return self }; }
        , docs = [ doc1, doc2 ]
        ;



      // enableXhr is false by default.
      sentDocs = renderedView = renderedInfo = null;

      req.resource.enableXhr = false;
      mongoRest = new MongoRest({ }, {  }, true); // Don't register routes
      mongoRest.renderCollection(docs, req, res, next);

      (sentDocs === null).should.be.true;
      renderedView.should.eql("resources/users");
      renderedInfo.should.eql({ docs: docs, site: 'user-list' });



      // Set enableXhr to true
      sentDocs = renderedView = renderedInfo = null;

      req.tmpFlashs = [ { type: "error", msg: "hi" } ];
      req.resource.enableXhr = true;

      mongoRest = new MongoRest({ }, { entityViewTemplate: 'resources/{{singularName}}', collectionViewTemplate: 'resources/{{pluralName}}' }, true); // Don't register routes
      mongoRest.renderCollection(docs, req, res, next);

      sentDocs.should.eql({ docs: docs });
      (renderedView === null).should.be.true;
      (renderedInfo === null).should.be.true;


      // Set enableXhr to true but the request is not xhr.
      sentDocs = renderedView = renderedInfo = null;

      mongoRest = new MongoRest({ }, { entityViewTemplate: 'resources/{{singularName}}', collectionViewTemplate: 'resources/{{pluralName}}' }, true); // Don't register routes
      req.xhr = false;
      mongoRest.renderCollection(docs, req, res, next);

      (sentDocs === null).should.be.true;
      renderedView.should.eql("resources/users");
      renderedInfo.should.eql({ docs: docs, site: 'user-list' });

    });
  });

  describe('collectionGet()', function() {
    var mongoRest = new MongoRest({ }, null, true) // Don't register routes
      , doc1 = new function() { this.doc1 = true; }
      , doc2 = new function() { this.doc2 = true; }
      , initialDocs = [ doc1, doc2 ]
      , exec = function(callback) {
          callback(null, initialDocs);
        }
      , sortParam = null
      , model = {
            lean: function() { return model; }
          ,  find: function() { return model; }
          , sort: function(sort) { sortParam = sort; return model; }
          , exec: exec
        }
      , req = { resource: { singularName: 'user', pluralName: 'users', model: model, sort: "-name" }, params: { resourceName: 'user' } }
      ;

    mongoRest.addResource("user", { });

    req.model = model;

    beforeEach(function() {
      sortParam = null;
    });

    it("should directly render if there are no interceptors", function(done) {
      mongoRest.renderCollection = function(docs) {
        sortParam.should.eql("-name");
        docs.should.eql(initialDocs);
        done();
      };

      mongoRest.collectionGet()(req, { }, { });

    });

    it("should call all 'get' interceptors and render the entity asynchroniously", function(done) {
      var interceptedCount = 0
        , interceptor = function(info, iDone) {
            info.doc.should.equal(initialDocs[interceptedCount % 2]);
            interceptedCount ++;
            setTimeout(function() { iDone(); }, 1);
          };

      mongoRest.renderCollection = function(docs) {
        interceptedCount.should.equal(6); // Each interceptor for each document.
        docs.should.eql(initialDocs);
        done();
      };
      req.model = model;

      mongoRest.addInterceptor("user", "get", interceptor);
      mongoRest.addInterceptor("user", "get", interceptor);
      mongoRest.addInterceptor("user", "get", interceptor);


      mongoRest.collectionGet()(req, { }, { });
    });

    it("should call all 'get' interceptors and render the entity synchroniously", function(done) {
      var interceptedCount = 0
        , interceptor = function(info, iDone) {
            info.doc.should.equal(initialDocs[interceptedCount % 2]);
            interceptedCount ++;
            iDone();
          };

      mongoRest.renderCollection = function(docs) {
        interceptedCount.should.equal(6); // Each interceptor for each document.
        docs.should.eql(initialDocs);
        done();
      };
      req.model = model;

      mongoRest.addInterceptor("user", "get", interceptor);
      mongoRest.addInterceptor("user", "get", interceptor);
      mongoRest.addInterceptor("user", "get", interceptor);


      mongoRest.collectionGet()(req, { }, { });
    });

  });

  describe("collectionPost()", function() {
    var mongoRest = new MongoRest({ }, null, true) // Don't register routes
      , emptyDoc = { save: function(callback) { setTimeout(callback, 1); } }
      , req = {
          body: { newResource: { some: 'values' } }
        , resource: { singularName: 'user', pluralName: 'users', model: function() { return emptyDoc; } }
        , params: { resourceName: 'user' }
        , flash: function() { }
      }
      ;

    beforeEach(function() {
      mongoRest = new MongoRest({ }, null, true); // Don't register routes
      mongoRest.addResource("user", { });
    });


    it("should call the 'post' and 'post.success' event interceptors on success", function(done) {
      var interceptorList = []
        , interceptor = function(intName) { return function(info, iDone) { interceptorList.push(intName); setTimeout(iDone, 1); } }
        ;

      mongoRest.addInterceptor("user", "post", interceptor("firstPost"));
      mongoRest.addInterceptor("user", "post", interceptor("secondPost"));
      mongoRest.addInterceptor("user", "post.success", interceptor("post.success"));
      mongoRest.addInterceptor("user", "post.error", interceptor("post.error"));

      var res = {
        redirect: function(address) {
          address.should.equal("/users");
          interceptorList.should.eql([ "firstPost", "secondPost", "post.success" ]);
          done();
        }
      };

      mongoRest.collectionPost()(req, res, { });
    });
    it("should call the 'post.error' event interceptors on error", function(done) {
      mongoRest.flash = function(type, message) { true.should.be.false; }

      emptyDoc = { save: function(callback) { setTimeout(function() { callback(new Error("Some Error")); }, 1); } }

      var interceptorList = []
        , interceptor = function(intName) { return function(info, iDone) { interceptorList.push(intName); setTimeout(iDone, 1); } }
        ;

      mongoRest.addInterceptor("user", "post", interceptor("firstPost"));
      mongoRest.addInterceptor("user", "post", interceptor("secondPost"));
      mongoRest.addInterceptor("user", "post.success", interceptor("post.success"));
      mongoRest.addInterceptor("user", "post.error", interceptor("post.error"));


      mongoRest.renderError = function(err, address, req, res, next) {
        err.message.should.equal("Unable to insert the record: Some Error");
        address.should.equal("/users");
        interceptorList.should.eql([ "firstPost", "secondPost", "post.error" ]);
        done();
      };

      mongoRest.collectionPost()(req, { }, { });
    });
    it("should call the 'post.error' event interceptors if the 'post' interceptor errors", function(done) {
      mongoRest.flash = function(type, message) { true.should.be.false; }

      emptyDoc = { save: function(callback) { setTimeout(function() { callback(); }, 1); } }

      var interceptorList = []
        , interceptor = function(intName) { return function(info, iDone) { interceptorList.push(intName); setTimeout(iDone, 1); } }
        ;

      mongoRest.addInterceptor("user", "post", interceptor("firstPost"));
      mongoRest.addInterceptor("user", "post", function(info, iDone) { iDone(new Error("interceptor error")); });
      mongoRest.addInterceptor("user", "post", interceptor("secondPost"));
      mongoRest.addInterceptor("user", "post.success", interceptor("post.success"));
      mongoRest.addInterceptor("user", "post.error", interceptor("post.error"));



      mongoRest.renderError = function(err, address, req, res, next) {
        err.message.should.equal("Unable to insert the record: interceptor error");
        address.should.equal("/users");
        interceptorList.should.eql([ "firstPost", "post.error" ]);
        done();
      };

      mongoRest.collectionPost()(req, { }, { });
    });
    it("should call the 'post.error' event interceptors if the post.success interceptor errors", function(done) {
      mongoRest.flash = function(type, message) { true.should.be.false; }

      emptyDoc = { save: function(callback) { setTimeout(function() { callback(); }, 1); } }

      var interceptorList = []
        , interceptor = function(intName) { return function(info, iDone) { interceptorList.push(intName); setTimeout(iDone, 1); } }
        ;

      mongoRest.addInterceptor("user", "post", interceptor("firstPost"));
      mongoRest.addInterceptor("user", "post", interceptor("secondPost"));
      mongoRest.addInterceptor("user", "post.success", interceptor("post.success"));
      mongoRest.addInterceptor("user", "post.error", interceptor("post.error"));

      mongoRest.addInterceptor("user", "post.success", function(info, iDone) { iDone(new Error("interceptor error")); });


      mongoRest.renderError = function(err, address, req, res, next) {
        err.message.should.equal("Unable to insert the record: interceptor error");
        address.should.equal("/users");
        interceptorList.should.eql([ "firstPost", "secondPost", "post.success", "post.error" ]);
        done();
      };

      mongoRest.collectionPost()(req, { }, { });
    });
  });


});