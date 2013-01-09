var MongoRest = require('../src/index')
  , _ = require('underscore')
;

describe('MongoRest', function() {

  describe("constructor", function() {
    it("should store the options", function() {
      var mongoRest
        , app = { };

      mongoRest = new MongoRest(app, null, true); // dont register routes
      mongoRest.options.should.eql({ urlPath: '/', entityViewTemplate: 'resource_{{singularName}}', collectionViewTemplate: 'resource_{{pluralName}}', enableXhr: false, singleView: true, entityDataName: '{{singularName}}', collectionDataName: '{{pluralName}}' });

      var options = { urlPath: '/some_url', entityViewTemplate: 'resources/{{singularName}}', collectionViewTemplate: 'resources/{{pluralName}}', enableXhr: true, singleView: false, entityDataName: '{{singularName}}ABC', collectionDataName: '{{pluralName}}ABC' };
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

      mongoRest.addResource("user", model1, { sort: "name" });
      mongoRest.addResource("hobby", model2, { pluralName: "hobbies" });

      mongoRest.resources.should.eql([
        { singularName: 'user', pluralName: 'users', model: model1, sort: "name", entityViewTemplate: "resource_user", collectionViewTemplate: "resource_users", enableXhr: false, singleView: true, entityDataName: 'user', collectionDataName: 'users' },
        { singularName: 'hobby', pluralName: 'hobbies', model: model2, entityViewTemplate: "resource_hobby", collectionViewTemplate: "resource_hobbies", entityDataName: 'hobby', collectionDataName: 'hobbies', enableXhr: false, singleView: true }
      ] );
    });
    it("should take the class config and copy it onto the resource", function() {
      var mongoRest
        , app = { }
        , model1 = new function() { this.model1 = true; }
        ;

      mongoRest = new MongoRest(app, {
        entityViewTemplate: "/{{singularName}}/bla",
        collectionViewTemplate: "/{{pluralName}}/bla",
        entityDataName: '{{singularName}}_doc',
        collectionDataName: '{{pluralName}}_docs',
        enableXhr: true,
        singleView: false
      }, true); // dont register routes

      mongoRest.addResource("user", model1);

      mongoRest.resources.should.eql([ {
        singularName: 'user',
        pluralName: 'users',
        model: model1,
        entityViewTemplate: "/user/bla",
        collectionViewTemplate: "/users/bla",
        entityDataName: 'user_doc',
        collectionDataName: 'users_docs',
        enableXhr: true,
        singleView: false
      }]);
    });
    it("the resource config should overwrite the class config", function() {
      var mongoRest
        , app = { }
        , model1 = new function() { this.model1 = true; }
        ;

      mongoRest = new MongoRest(app, {
        entityViewTemplate: "/{{singularName}}/bla",
        collectionViewTemplate: "/{{pluralName}}/bla",
        entityDataName: "ABC",
        collectionDataName: "DEF",
        enableXhr: true,
        singleView: false
      }, true); // dont register routes

      mongoRest.addResource("user", model1, {
        entityViewTemplate: "/{{singularName}}/bleee",
        collectionViewTemplate: "/{{pluralName}}/bleee",
        entityDataName: "{{singularName}}_DOC",
        collectionDataName: "{{pluralName}}_DOC",
        enableXhr: false,
        singleView: true,
        sort: "test",
        pluralName: "userers"
      });

      mongoRest.resources.should.eql([ {
        singularName: 'user',
        pluralName: 'userers',
        model: model1,
        entityViewTemplate: "/user/bleee",
        collectionViewTemplate: "/userers/bleee",
        entityDataName: "user_DOC",
        collectionDataName: "userers_DOC",
        enableXhr: false,
        sort: "test",
        singleView: true
      }]);
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
      mongoRest.addResource("hobby", model2, { pluralName: "hobbies" });

      var userResource = mongoRest.resources[0];
      // var userResource = { singularName: 'user', pluralName: 'users', model: model1, entityViewTemplate: "resource_user", collectionViewTemplate: "resource_users", enableXhr: false, singleView: true };
      mongoRest.getResource("user").should.eql(userResource);
      mongoRest.getResource("users").should.eql(userResource);

      var hobbyResource = mongoRest.resources[1];
      // var hobbyResource = { singularName: 'hobby', pluralName: 'hobbies', model: model2, entityViewTemplate: "resource_hobby", collectionViewTemplate: "resource_hobbies", entityViewTemplate: "resource_hobby", collectionViewTemplate: "resource_hobbies", enableXhr: false, singleView: true };
      mongoRest.getResource("hobbies").should.eql(hobbyResource);
      mongoRest.getResource("hobby").should.eql(hobbyResource);

    });
  });

  describe("_substituteNames()", function() {
    it("should replace all values properly", function() {
      var mongoRest
        , app = { }
        ;

      mongoRest = new MongoRest(app, null, true); // dont register routes

      mongoRest._substituteNames("abc.{{singularName}}.def.{{pluralName}}", { singularName: 'user', pluralName: 'users' }).should.eql("abc.user.def.users");
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
      mongoRest.getEntityUrl({ singularName: 'user', pluralName: 'users', singleView: true }, { _id: 123 }).should.equal("/resource/user/123");

    });
    it("should return the colleciton url if no single view in resource", function() {
      var mongoRest, app = { };

      mongoRest = new MongoRest(app, { urlPath: "/resource/", singleView: true }, true); // dont register routes
      mongoRest.getEntityUrl({ singularName: 'user', pluralName: 'users', singleView: false }, { _id: 123 }).should.equal("/resource/users");

    });
  })

  describe("redirect()", function() {
    it("should redirect if not xhr", function(done) {
      var mongoRest, app = { }
        , req = {
          resource: { enableXhr: true }
        }
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
        , req = { xhr: true, resource: { enableXhr: true } }
        , res = { send: function(obj) {
            obj.should.eql({ redirect: "test" });
            done();
          }}
        , next = function() { };
      mongoRest = new MongoRest(app, { enableXhr: true }, true); // dont register routes

      mongoRest.redirect("test", req, res, next);
    });
    it("should take the config from the resource not the class", function(done) {
      var mongoRest, app = { }
        , req = { xhr: true, resource: { enableXhr: true } }
        , res = { send: function(obj) {
            obj.should.eql({ redirect: "test" });
            done();
          }}
        , next = function() { };

      // Now setting enableXhr to false here, but the resource config should be taken
      mongoRest = new MongoRest(app, { enableXhr: false }, true); // dont register routes

      mongoRest.redirect("test", req, res, next);
    });
  });


  describe("flash()", function() {
    it("should do nothing if xhr", function() {
      var mongoRest, app = { }
        , req = {
          xhr: true,
          resource: { enableXhr: true },
          flash: function() { true.should.be.false; }
        }
        ;

      mongoRest = new MongoRest(app, { enableXhr: true }, true); // dont register routes

      mongoRest.flash("error", "hi", req);
      mongoRest.flash("success", "hi2", req);

    });
    it("should forward to req.flash() directly if xhr is disabled on resource", function(done) {
      var mongoRest, app = { }
        , req = {
            xhr: true,
            resource: { enableXhr: false },
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
            resource: { enableXhr: true },
            xhr: true
          }
        , next = function() { }
        ;
      // The enableXhr setting here should be ignored
      mongoRest = new MongoRest(app, { enableXhr: false }, true); // dont register routes

      mongoRest.flash("error", "test message", req);

      mongoRest.renderError(new Error("Some error"), "some/url", req, res, next);
    });
    it("should forward to next() if not XHR", function(done) {
      var mongoRest, app = { }
        , res = {
          }
        , flashed = []
        , req = {
            xhr: false,
            resource: { enableXhr: true },
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
      // The enableXhr setting here should be ignored.
      mongoRest = new MongoRest(app, { enableXhr: true }, true); // dont register routes

      mongoRest.flash("error", "test message", req);

      mongoRest.renderError("Some error", null, req, res, next);
    });
  });

});