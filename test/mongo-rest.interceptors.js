var MongoRest = require('../lib/index')
  , _ = require('underscore')
  , req = new function() { this.req = true }
  , res = new function() { this.res = true }
  , next = function() { var next = true }
;

describe('MongoRest interceptors', function() {

  describe("addInterceptor()", function() {
    it("should handle calss with a string as event", function() {
      var mongoRest = new MongoRest({ }, null, true); // dont register routes

      var interceptor1 = new function() { this.inter1 = true; }
        , interceptor2 = new function() { this.inter2 = true; };
      mongoRest.addInterceptor("user", "post", interceptor1);
      mongoRest.addInterceptor("user", "post", interceptor2);
      mongoRest.addInterceptor("address", "delete", interceptor2);

      mongoRest.interceptors.should.eql({ user: { post: [ interceptor1, interceptor2 ] },  address: { delete: [ interceptor2 ] }});
    });
    it("should handle an array of events", function() {
      var mongoRest = new MongoRest({ }, null, true); // dont register routes

      var interceptor1 = new function() { this.inter1 = true; }
        , interceptor2 = new function() { this.inter2 = true; };
      mongoRest.addInterceptor("user", [ "post", "put", "delete" ], interceptor1);
      mongoRest.addInterceptor("user", [ "post", "delete" ], interceptor2);
      mongoRest.addInterceptor("address", [ "put", "delete" ], interceptor2);

      mongoRest.interceptors.should.eql({ user: { post: [ interceptor1, interceptor2 ], put: [ interceptor1 ], delete: [ interceptor1, interceptor2 ] },  address: { put: [ interceptor2 ], delete: [ interceptor2 ] }});
    });
  });

  describe('invokeInterceptors()', function() {
    var mongoRest = new MongoRest({ }, null, true); // dont register routes
    mongoRest.addResource('users', {});
    it('should call callback directly if there is no interceptor', function() {
      var called = false;
      mongoRest.invokeInterceptors('users', 'get', { doc: { } }, req, res, next, function() { called = true; });
      called.should.be.true;
    });
    it('should call callback when interceptor finished synchronously', function() {
      var called = false;
      mongoRest.addInterceptor('users', 'get', function(info, done) { done(); });
      mongoRest.invokeInterceptors('users', 'get', { doc: { } }, req, res, next, function() { called = true; });
      called.should.be.true;
    });
    it('should call callback exactly once when multiple interceptors finish synchronously', function() {
      var called = 0;
      mongoRest.addInterceptor('users', 'get', function(info, done) { done(); });
      mongoRest.addInterceptor('users', 'get', function(info, done) { done(); });
      mongoRest.addInterceptor('users', 'get', function(info, done) { done(); });
      mongoRest.invokeInterceptors('users', 'get', { doc: { } }, req, res, next, function() { called ++; });
      called.should.equal(1);
    });
    it('should call callback when interceptor finished asynchronously', function(done) {
      mongoRest.addInterceptor('users', 'get', function(info, done) { setTimeout(done, 1); });
      mongoRest.invokeInterceptors('users', 'get', { doc: { } }, req, res, next, function() { done(); });
    });
    it('should call callback exactly once when multiple interceptors finish asynchronously', function(done) {
      mongoRest.addInterceptor('users', 'get', function(info, done) { setTimeout(done, 1); });
      mongoRest.addInterceptor('users', 'get', function(info, done) { setTimeout(done, 1); });
      mongoRest.addInterceptor('users', 'get', function(info, done) { setTimeout(done, 1); });
      mongoRest.invokeInterceptors('users', 'get', { doc: { } }, req, res, next, function() { done(); });
    });

    it('should actually invoke the "get" interceptors with each doc when "collection-get" is invoked', function(done) {
      var called = 0
        , doc1 = new function() { }
        , doc2 = new function() { }
        , doc3 = new function() { }
        ;
      var docs = [doc1, doc2, doc3]
        , remainingDocs = [doc1, doc2, doc3];

      mongoRest.addInterceptor('users', 'get', function(info, done) {
        // Check if the doc actually exists.
        var index = remainingDocs.indexOf(info.doc);
        index.should.not.equal(-1);
        // Delete it to make sure it's not called twice with the same doc.
        delete remainingDocs[index];
        called ++;
        setTimeout(done, 1);
      });
      mongoRest.invokeInterceptors('users', 'get-collection', { docs: docs }, req, res, next, function() {
        called.should.equal(3);
        done();
      });
    });

  });
});