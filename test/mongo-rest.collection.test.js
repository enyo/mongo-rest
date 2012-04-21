var MongoRest = require('../lib/index')
  , _ = require('underscore')
;

describe('MongoRest', function() {

  describe("renderCollection()", function() {
    it('should render a collection correctly depending on the request');
  });

  describe('collectionGet()', function() {
    var mongoRest = new MongoRest({ }, null, true) // Don't register routes
      , doc1 = new function() { this.doc1 = true; }
      , doc2 = new function() { this.doc2 = true; }
      , initialDocs = [ doc1, doc2 ]
      , req = { model: { }, params: { resource: 'user' } }
      , run = function(callback) {
          callback(null, initialDocs);
        }
      , model = {
            find: function() { return model; }
          , sort: function() { return model; }
          , run: run
        }
      ;

    req.model = model;

    it("should directly render if there are no interceptors", function(done) {
      mongoRest.renderCollection = function(docs) {
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
    it("should call the 'post' event interceptors");
    it("should call the 'post.success' event interceptors on success");
    it("should call the 'post.error' event interceptors on error");
  });


});