mocha = ./node_modules/mocha/bin/mocha

test:
	$(mocha) --reporter spec

.PHONY: test