#!/bin/bash

echo "Going to checkout master..." &&
read && 
git checkout master &&
echo "Going to publish to npm..." &&
read &&
npm publish && 
echo "Going to checkout develop..." &&
read &&
git checkout develop

