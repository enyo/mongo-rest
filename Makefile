mocha = ./node_modules/mocha/bin/mocha
coffee = ./node_modules/coffee-script/bin/coffee

test:
	$(mocha) --reporter spec

build:
	$(coffee) -co lib src
watch:
	$(coffee) -cwo lib src

.PHONY: test