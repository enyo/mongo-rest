# MongoREST Version 1.0.4-dev

This is an [express][] [node][] [module][node modules] to provide basic [REST][] support to access [mongodb][] [documents][mongodb documents] via [mongoose][].


[express]: http://www.expressjs.com/
[node]: http://www.nodejs.org
[node modules]: http://nodejs.org/api/modules.html
[REST]: http://en.wikipedia.org/wiki/Representational_state_transfer
[mongodb]: http://www.mongodb.org
[mongodb documents]: http://www.mongodb.org/display/DOCS/Documents
[mongoose]: http://www.mongoosejs.com


I use [semantic versioning](http://semver.org/) and my [tag script](https://github.com/enyo/tag) to tag this module.

## Usage

The usage of this module is quite straight forward:

1. Include and instantiate `mongo-rest`.
2. Provide `mongo-rest` with the [mongoose models][mongoose model] you want to support.
3. Create a view file for each resource you want rendered as HTML.
4. Optionally you can also define interceptors in case you want some resources to be handled exceptionally.

That's it, you're done.


### 1. Including and instantiating mongo-rest

MongoREST exposes a class you instatiate with your options. The long version looks like this:

    var MongoRest = require('mongo-rest')
      , mongoRest = new MongoRest(app, { viewPath: 'admin/resources/' });

The options for MongoRest are:

  - `urlPath`: The path were the REST interface is accessible. Defaults to `/`.
  - `viewPath`: The path were the views to render resources are located.
  - `viewPrefix`: The prefix of the resource views. Defaults to 'resource_'. So for example a list of users will use the view `resource_users`

As a one liner it looks like this:

    var mongoRest = new (require('mongo-rest'))({ viewPath: 'admin/resources/' });

When instantiated, MongoREST registers the routes with the `app` so that all REST routes become accessible. If you provided `'/resources/'` as `urlPath` then following urls will become alive for the `users` resource:

    GET: /resources/users (Renders a list of all users)
    POST: /resources/users (Creates a new user)

    GET: /resources/users/id/12345 (Renders the user with ID 12345)
    PUT: /resources/users/id/12345 (Updates the user with ID 12345)
    DELETE: /resources/users/id/12345 (Deletes the user with ID 12345)

### 2. Adding a mongoose model as resource

To tell `mongo-rest` which resources it should support you simple add each [mongoose model]. Normally you do this in the same place you define your routes. The code is quite straight forward:

    mongoRest.addResource('users', require('../models/user'));

That's it. Now MongoREST nows that it has to use this model whenever the resource `users` is accessed.


### 3. Create your views

When you access `/resources/users` for example, MongoREST will try to render this list. To do this it will need a template files.

Two template files are needed for each resource to...

  1. ...render a list of the resource
  2. ...render a single resource

To define where the views are located you pass the `viewPath` option. If you pass `resources_views/` as `viewPath` and `resource_` as `viewPrefix` then MongoREST will use `resources_views/resource_users` as view for a list of users and `resources_views/resource_users_show` as view for a single user.

### 4. Create interceptors (Optional)

Sometimes some actions need to be taken before or after inserting, updating or deleting records.

You register an interceptor like this:

    var eventName = 'post.success'
      , handler = function(info, req, res, next) { };

    mongoRest.addInterceptor('users', eventName, handler);
    // You can also provide the same handler for multiple event names:
    mongoRest.addInterceptor('users', [ 'post', 'put' ], function() { });


The available event names are:

  - `post`, `post.success`, `post.error` Called when a new resource is posted.
  - `put`, `put.success`, `put.error` Called when a resource is updated.
  - `delete`, `delete.success`, `delete.error` Called when a resource is deleted.

If you simply use the event name without `.success` or `.error` it will be called **before** the event will be carried out.

The parameters provided to the handler are:

  - `info` An object containing the `doc` and or the `values` that will be used to update the record
  - `req`
  - `res`


An example of an interceptor could look like this:

    /**
     * Intercepts posts and puts for guestbook-messages. It compiles the provided textSource with jade, and stores
     * the old textSource in a textVersions array to provide a history.
     */
    mongoRest.addInterceptor('guestbook-messages', [ 'post', 'put' ], function(info) {
      // Compile the new textSource value with jade, and put the compiled code in textHtml
      info.values.textHtml = (jade.compile(info.values.textSource))({});
      // Since there is no existing doc when posting a new resource, we test if it exists...
      if (info.doc) {
        // ...and if it does we add the old textSource to the textVersions array to have a history.
        info.doc.textVersions.push(info.doc.textSource);
      }
    });



## Tagging

I use


[mongoose model]: http://mongoosejs.com/docs/model-definition.html