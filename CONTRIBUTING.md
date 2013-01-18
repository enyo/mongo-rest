# Contributing guidelines

This lib is written in coffeescript! Do not edit the JS files directly.

Edit the `.coffee` files in `src/`.

## Testing

The tests run against the coffee files so you don't need to compile coffee in
order to run tests.

To run tests:

```bash
$ npm test
```

## Compiling

I compile the coffee before publishing to npm so you shouldn't need to do so.

To compile coffee anyways:

```bash
$ make build
```

or to watch the files:

```bash
$ make watch
```


