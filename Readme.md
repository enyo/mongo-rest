# MongooseREST

This is an [express] [node] [module][node modules] to provide basic [REST] support to access [mongodb] [documents][mongodb documents] via [mongoose].


[express]: http://www.expressjs.com/
[node]: www.nodejs.org
[node modules]: http://nodejs.org/api/modules.html
[REST]: http://en.wikipedia.org/wiki/Representational_state_transfer
[mongodb]: www.mongodb.org
[mongodb documents]: http://www.mongodb.org/display/DOCS/Documents
[mongoose]: www.mongoosejs.com



## Usage

The usage of this module is quite straight forward:

1. Include and instantiate `mongoose-rest`.
2. Provide `mongoose-rest` with the [mongoose models][mongoose model] you want to support.
3. Create a view file for each resource you want rendered as HTML.

That's it, you're done.

4. Optionally you can also define interceptors in case you want some resources to be handled exceptionally.


### 1. Including and instantiating mongoose-rest

MongooseREST exposes a class you instatiate with your options. The long version looks like this:

    var MongooseRest = require('mongoose-rest')
      , mongooseRest = new MongooseRest(app, { viewPath: 'admin/resources/' });

The options for MongooseRest are:
  - `urlPath`: The path were the REST interface is accessible. Defaults to `/`.
  - `viewPath`: The path were the views to render resources are located.
  - `viewPrefix`: The prefix of the resource views. Defaults to 'resource_'. So for example a list of users will use the view `resource_users`

As a one liner it looks like this:

    var mongooseRest = new (require('mongoose-rest'))({ viewPath: 'admin/resources/' });

When instantiated, MongooseREST registers the routes with the `app` so that all REST routes become accessible. If you provided `'/resources/'` as `urlPath` then following urls will become alive for the `users` resource:

    GET: /resources/users (Renders a list of all users)
    POST: /resources/users (Creates a new user)

    GET: /resources/users/id/12345 (Renders the user with ID 12345)
    PUT: /resources/users/id/12345 (Updates the user with ID 12345)
    DELETE: /resources/users/id/12345 (Deletes the user with ID 12345)

### 2. Adding a mongoose model as resource

To tell `mongoose-rest` which resources it should support you simple add each [mongoose model]. Normally you do this in the same place you define your routes. The code is quite straight forward:

    mongooseRest.addResource('users', require('../models/user'));

That's it. Now MongooseREST nows that it has to use this model whenever the resource `users` is accessed.


### 3. Create your views

When you access `/resources/users` for example, MongooseREST will try to render this list. To do this it will need a template files.

Two template files are needed for each resource to...

  1. ...render a list of the resource
  2. ...render a single resource

To define where the views are located you pass the `viewPath` option. If you pass `resources_views/` as `viewPath` and `resource_` as `viewPrefix` then MongooseREST will use `resources_views/resource_users` as view for a list of users and `resources_views/resource_users_show` as view for a single user.

### 4. Create interceptors (Optional)

Sometimes some actions need to be taken before or after inserting, updating or deleting records.

You register an interceptor like this:

    var eventName = 'post.success'
      , handler = function(info, req, res, next) { };

    mongooseRest.addInterceptor('users', eventName, handler);

The available event names are:

  - `post`, `post.success`, `post.error` Called when a new resource is posted.
  - `put`, `put.success`, `put.error` Called when a resource is updated.
  - `delete`, `delete.success`, `delete.error` Called when a resource is deleted.

If you simply use the event name without `.success` or `.error` it will be called **before** the event will be carried out.

The parameters provided to the handler are:

  - `info` An object containing the `doc` and or the `values` that will be used to update the record
  - `req`
  - `res`


[mongoose model]: http://mongoosejs.com/docs/model-definition.html