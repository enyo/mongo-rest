#!/bin/bash

echo "Going to checkout master, publish to npm and checkout develop. OK? " &&
read && 
git checkout master &&
npm publish && 
git checkout develop

