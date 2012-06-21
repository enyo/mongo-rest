var MongoRest = require('../lib/index')
  , _ = require('underscore')
  , req = new function() { this.req = true }
  , res = new function() { this.res = true }
  , next = function() { var next = true }
;

describe('MongoRest interceptors', function() {

  describe("addInterceptor()", function() {
    it("should throw an error if the resource is undefined", function() {
      var mongoRest = new MongoRest({ }, null, true); // dont register routes

      (function() {
        mongoRest.addInterceptor("user", "post", function() { });
      }).should.throw("The resource user is not defined!");
    });
    it("should handle class with a string as event", function() {
      var mongoRest = new MongoRest({ }, null, true); // dont register routes

      mongoRest.addResource("user", { });
      mongoRest.addResource("address", { });

      var interceptor1 = new function() { this.inter1 = true; }
        , interceptor2 = new function() { this.inter2 = true; };
      mongoRest.addInterceptor("user", "post", interceptor1);
      mongoRest.addInterceptor("user", "post", interceptor2);
      mongoRest.addInterceptor("address", "delete", interceptor2);

      mongoRest.interceptors.should.eql({ user: { post: [ interceptor1, interceptor2 ] },  address: { delete: [ interceptor2 ] }});
    });
    it("should handle an array of events", function() {
      var mongoRest = new MongoRest({ }, null, true); // dont register routes

      mongoRest.addResource("user", { });
      mongoRest.addResource("address", { });

      var interceptor1 = new function() { this.inter1 = true; }
        , interceptor2 = new function() { this.inter2 = true; };
      mongoRest.addInterceptor("user", [ "post", "put", "delete" ], interceptor1);
      mongoRest.addInterceptor("user", [ "post", "delete" ], interceptor2);
      mongoRest.addInterceptor("address", [ "put", "delete" ], interceptor2);

      mongoRest.interceptors.should.eql({ user: { post: [ interceptor1, interceptor2 ], put: [ interceptor1 ], delete: [ interceptor1, interceptor2 ] },  address: { put: [ interceptor2 ], delete: [ interceptor2 ] }});
    });
  });

  describe('invokeInterceptors()', function() {
    var mongoRest;
    beforeEach(function() {
      mongoRest = new MongoRest({ }, null, true); // dont register routes
      mongoRest.addResource('user', {});
    });
    it('should call callback directly if there is no interceptor', function() {
      var called = false;
      mongoRest.invokeInterceptors('user', 'get', { doc: { } }, req, res, next, function() { called = true; });
      called.should.be.true;
    });
    it('should call callback when interceptor finished synchronously', function() {
      var called = false;
      mongoRest.addInterceptor('user', 'get', function(info, done) { done(); });
      mongoRest.invokeInterceptors('user', 'get', { doc: { } }, req, res, next, function() { called = true; });
      called.should.be.true;
    });
    it('should call callback exactly once when multiple interceptors finish synchronously', function() {
      var called = 0;
      mongoRest.addInterceptor('user', 'get', function(info, done) { done(); });
      mongoRest.addInterceptor('user', 'get', function(info, done) { done(); });
      mongoRest.addInterceptor('user', 'get', function(info, done) { done(); });
      mongoRest.invokeInterceptors('user', 'get', { doc: { } }, req, res, next, function() { called ++; });
      called.should.equal(1);
    });
    it('should call callback when interceptor finished asynchronously', function(done) {
      mongoRest.addInterceptor('users', 'get', function(info, done) { setTimeout(done, 1); });
      mongoRest.invokeInterceptors('users', 'get', { doc: { } }, req, res, next, function() { done(); });
    });
    it('should call callback exactly once when multiple interceptors finish asynchronously', function(done) {
      mongoRest.addInterceptor('user', 'get', function(info, done) { setTimeout(done, 1); });
      mongoRest.addInterceptor('user', 'get', function(info, done) { setTimeout(done, 1); });
      mongoRest.addInterceptor('user', 'get', function(info, done) { setTimeout(done, 1); });
      mongoRest.invokeInterceptors('user', 'get', { doc: { } }, req, res, next, function() { done(); });
    });

    it('should actually invoke the "get" interceptors with each doc when "collection-get" is invoked', function(done) {
      var called = 0
        , doc1 = new function() { }
        , doc2 = new function() { }
        , doc3 = new function() { }
        ;
      var docs = [doc1, doc2, doc3]
        , remainingDocs = [doc1, doc2, doc3];

      mongoRest.addInterceptor('user', 'get', function(info, done) {
        // Check if the doc actually exists.
        var index = remainingDocs.indexOf(info.doc);
        index.should.not.equal(-1);
        // Delete it to make sure it's not called twice with the same doc.
        delete remainingDocs[index];
        called ++;
        setTimeout(done, 1);
      });
      mongoRest.invokeInterceptors('user', 'get-collection', { docs: docs }, req, res, next, function() {
        called.should.equal(3);
        done();
      });
    });
    it('should stop invoking interceptors when one interceptor fails and forward the error to onFinish() synchronously', function(done) {
      var called = 0;
      var err1 = new Error("err1")
        , err2 = new Error("err2")
        , err3 = new Error("err3");
      mongoRest.addInterceptor('user', 'get', function(info, done) { called ++; done(err1); });
      mongoRest.addInterceptor('user', 'get', function(info, done) { called ++; done(err2); });
      mongoRest.addInterceptor('user', 'get', function(info, done) { called ++; done(err3); });

      mongoRest.invokeInterceptors('user', 'get', { doc: { } }, req, res, next, function(err) {
        err.should.equal(err1);
        called.should.equal(1);
        done();
      });
    });
    it('should forward the error to onFinish() asynchronously', function(done) {
      var called = 0;
      var err1 = new Error("err1")
        , err2 = new Error("err2")
        , err3 = new Error("err3");

      mongoRest.addInterceptor('user', 'get', function(info, done) { called ++; setTimeout(function() { done(err1); }, 10); });
      mongoRest.addInterceptor('user', 'get', function(info, done) { called ++; setTimeout(function() { done(err2); }, 10); });
      mongoRest.addInterceptor('user', 'get', function(info, done) { called ++; setTimeout(function() { done(err3); }, 1); });

      mongoRest.invokeInterceptors('user', 'get', { doc: { } }, req, res, next, function(err) {
        err.should.equal(err3);
        called.should.equal(3);
        done();
      });
    });
    it('should stop invoking interceptors when one interceptor fails with get-collection as well', function(done) {
      var called = 0;
      var err1 = new Error("err1")
        , err2 = new Error("err2")
        , err3 = new Error("err3");

      // this interceptor calls `done` with an error only if the document contains `a`. Which means
      // that it will be called 3 times.
      mongoRest.addInterceptor('user', 'get', function(info, done) { called ++; done(info.doc.a ? err1 : null); });
      mongoRest.addInterceptor('user', 'get', function(info, done) { called ++; done(err2); });
      mongoRest.addInterceptor('user', 'get', function(info, done) { called ++; done(err3); });

      mongoRest.invokeInterceptors('user', 'get-collection', { docs: [{ }, { }, { a: 1 }] }, req, res, next, function(err) {
        err.should.equal(err1);
        called.should.equal(3);
        done();
      });
    });

  });
});