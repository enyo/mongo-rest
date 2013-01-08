var MongoRest = require('../src/index')
  , _ = require('underscore')
;

describe('MongoRest', function() {

  describe("constructor", function() {
    it("should store the options", function() {
      var mongoRest
        , app = { };

      mongoRest = new MongoRest(app, null, true); // dont register routes
      mongoRest.options.should.eql({ urlPath: '/', entityViewTemplate: 'resource_{{singularName}}', collectionViewTemplate: 'resource_{{pluralName}}', enableXhr: false, singleView: true });

      var options = { urlPath: '/some_url', entityViewTemplate: 'resources/{{singularName}}', collectionViewTemplate: 'resources/{{pluralName}}', enableXhr: true, singleView: false };
      mongoRest = new MongoRest(app, options, true); // dont register routes
      mongoRest.options.should.eql(options);

    });

    describe("routes", function() {
      var mongoRest
        , registered
        , app = {
              all: function(address) { registered.push([ 'all', address ]) }
            , get: function(address) { registered.push([ 'get', address ]) }
            , post: function(address) { registered.push([ 'post', address ]) }
            , put: function(address) { registered.push([ 'put', address ]) }
            , delete: function(address) { registered.push([ 'delete', address ]) }
          };
      it("should register routes if asked nicely", function() {
        registered = [];
        mongoRest = new MongoRest(app, { urlPath: '/some/url/' });
        registered.should.eql([
          [ 'all', '/some/url/:resourceName' ],
          [ 'get', '/some/url/:resourceName' ],
          [ 'post', '/some/url/:resourceName' ],
          [ 'all', '/some/url/:resourceName/:id' ],
          [ 'get', '/some/url/:resourceName/:id' ],
          [ 'put', '/some/url/:resourceName/:id' ],
          [ 'delete', '/some/url/:resourceName/:id' ] 
        ]);
      });

      it("shouldn't register routes if asked nicely", function() {
        registered = [];
        mongoRest = new MongoRest(app, { urlPath: '/some/url/' }, true); // Don't register routes.
        registered.should.eql([]);
      });
    });

  });

  describe("addResource()", function() {
    it("should handle singular and plurar names correctly", function() {
      var mongoRest
        , app = { }
        , model1 = new function() { this.model1 = true; }
        , model2 = new function() { this.model2 = true; }
        ;

      mongoRest = new MongoRest(app, null, true); // dont register routes

      mongoRest.addResource("user", model1);
      mongoRest.addResource("hobby", model2, "hobbies");

      mongoRest.resources.should.eql([ { singularName: 'user', pluralName: 'users', model: model1 }, { singularName: 'hobby', pluralName: 'hobbies', model: model2 } ] );
    });
  });

  describe("getResource()", function() {
    it("should return singular or plural names", function() {
      var mongoRest
        , app = { }
        , model1 = new function() { this.model1 = true; }
        , model2 = new function() { this.model2 = true; }
        ;

      mongoRest = new MongoRest(app, null, true); // dont register routes

      mongoRest.addResource("user", model1);
      mongoRest.addResource("hobby", model2, "hobbies");

      mongoRest.getResource("hobbies").should.eql({ singularName: 'hobby', pluralName: 'hobbies', model: model2 });
      mongoRest.getResource("hobby").should.eql({ singularName: 'hobby', pluralName: 'hobbies', model: model2 });
      mongoRest.getResource("user").should.eql({ singularName: 'user', pluralName: 'users', model: model1 });
      mongoRest.getResource("users").should.eql({ singularName: 'user', pluralName: 'users', model: model1 });

    });
  });

  describe("parseViewTemplate()", function() {
    it("should replace all values properly", function() {
      var mongoRest
        , app = { }
        ;

      mongoRest = new MongoRest(app, null, true); // dont register routes

      mongoRest.parseViewTemplate("abc.{{singularName}}.def.{{pluralName}}", { singularName: 'user', pluralName: 'users' }).should.eql("abc.user.def.users");
    });
  });

  describe("getCollectionUrl()", function() {
    it("should return the correct url", function() {
      var mongoRest, app = { };

      mongoRest = new MongoRest(app, { urlPath: "/resource/" }, true); // dont register routes
      mongoRest.getCollectionUrl({ singularName: 'user', pluralName: 'users' }).should.equal("/resource/users");

    });
  })

  describe("getEntityUrl()", function() {
    it("should return the correct url", function() {
      var mongoRest, app = { };

      mongoRest = new MongoRest(app, { urlPath: "/resource/", singleView: true }, true); // dont register routes
      mongoRest.getEntityUrl({ singularName: 'user', pluralName: 'users' }, { _id: 123 }).should.equal("/resource/user/123");

    });
    it("should return the colleciton url if no single view", function() {
      var mongoRest, app = { };

      mongoRest = new MongoRest(app, { urlPath: "/resource/", singleView: false }, true); // dont register routes
      mongoRest.getEntityUrl({ singularName: 'user', pluralName: 'users' }, { _id: 123 }).should.equal("/resource/users");

    });
  })

  describe("redirect()", function() {
    it("should redirect if not xhr", function(done) {
      var mongoRest, app = { }
        , req = {}
        , res = { redirect: function(address) {
            address.should.equal("test");
            done();
          }}
        , next = function() { };
      mongoRest = new MongoRest(app, null, true); // dont register routes

      mongoRest.redirect("test", req, res, next);
    });
    it("should return a redirect string if xhr", function(done) {
      var mongoRest, app = { }
        , req = { xhr: true }
        , res = { send: function(obj) {
            obj.should.eql({ redirect: "test" });
            done();
          }}
        , next = function() { };
      mongoRest = new MongoRest(app, { enableXhr: true }, true); // dont register routes

      mongoRest.redirect("test", req, res, next);
    });
  });


  describe("flash()", function() {
    it("should do nothing if xhr", function() {
      var mongoRest, app = { }
        , req = {
          xhr: true,
          flash: function() { true.should.be.false; }
        }
        ;

      mongoRest = new MongoRest(app, { enableXhr: true }, true); // dont register routes

      mongoRest.flash("error", "hi", req);
      mongoRest.flash("success", "hi2", req);

    });
    it("should forward to req.flash() directly if not xhr.", function(done) {
      var mongoRest, app = { }
        , req = {
            xhr: true,
            flash: function(type, msg) {
              type.should.equal("error");
              msg.should.equal("some message");
              done();
            }
          }
        ;
      mongoRest = new MongoRest(app, { enableXhr: false }, true); // dont register routes

      mongoRest.flash("error", "some message", req);

    });
  });


  describe("renderError()", function() {
    it("should send the error without flash message if XHR", function(done) {
      var mongoRest, app = { }
        , res = {
            send: function(info) {
              info.should.eql({ error: 'Some error', redirect: "some/url" });
              done();
            }
          }
        , req = {
            xhr: true
          }
        , next = function() { }
        ;
      mongoRest = new MongoRest(app, { enableXhr: true }, true); // dont register routes

      mongoRest.flash("error", "test message", req);

      mongoRest.renderError(new Error("Some error"), "some/url", req, res, next);
    });
    it("should forward to next() if not XHR", function(done) {
      var mongoRest, app = { }
        , res = {
          }
        , flashed = []
        , req = {
            xhr: true,
            flash: function(type, msg) {
              flashed.push([type, msg]);
            }
          }
        , next = function(err) {
            flashed.should.eql([ ["error", "test message"] ]);
            err.should.eql("Some error");
            done();
          }
        ;
      mongoRest = new MongoRest(app, { enableXhr: false }, true); // dont register routes

      mongoRest.flash("error", "test message", req);

      mongoRest.renderError("Some error", null, req, res, next);
    });
  });

});