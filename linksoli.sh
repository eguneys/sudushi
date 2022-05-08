git clone https://github.com/eguneys/cardstwo
cd cardstwo
yarn install
yarn build
yarn link

cd ..

git clone https://github.com/eguneys/soli2d
cd soli2d
yarn install
yarn build
yarn link

cd ..

git clone https://github.com/eguneys/sol-expressions
cd sol-expressions
yarn install
yarn link soli2d
yarn bootstrap
lerna exec yarn link

cd ..

git clone https://github.com/eguneys/soli2d-js
cd soli2d-js
yarn install
yarn link sol-expressions
yarn build
lerna exec yarn link
cd ..
