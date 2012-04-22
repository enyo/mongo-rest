var MongoRest = require('../lib/index')
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

    it("should register routes if asked nicely");

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

      mongoRest.parseViewTemplate("abc.{{singularName}}.def.{{pluralName}}", { singularName: 'user', pluralName: 'users' }).should.equal("abc.user.def.users")

    });
  });

});