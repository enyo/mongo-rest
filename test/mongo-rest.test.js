var MongoRest = require('../lib/index')
  , _ = require('underscore')
;

describe('MongoRest', function() {

  describe("constructor", function() {
    it("should store the options", function() {
      var mongoRest
        , app = { };

      mongoRest = new MongoRest(app, null, true); // dont register routes
      mongoRest.options.should.eql({ urlPath: '/', viewPath: '', viewPrefix: 'resource_', enableXhr: false, singleView: true });

      var options = { urlPath: '/some_url', viewPath: '/views', viewPrefix: 'my_nice_resource_', enableXhr: true, singleView: false };
      mongoRest = new MongoRest(app, options, true); // dont register routes
      mongoRest.options.should.eql(options);

    });

    it("should register routes if asked nicely");

  // , df = function() { }
  // , app = { all: df, get: df, put: df, post: df, delete: df }

  });
});