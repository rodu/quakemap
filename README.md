# QuakeMap

## Real-time Earthquake data Visualizer

Using the data from the [USGS](http://earthquake.usgs.gov/earthquakes/) the app visualizes on a map the list of recent recorded earthquakes.

### API Documentation

http://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php

### Live demo

A running demo of the app can be found at: https://rodu.github.io/quakemap

### Technology stack

This project is an experiment to learn consuming observable streams with RxJS.

The app is compatible with mobile and desktop devices via taking advantage of the brilliant Bootstrap 3.

Technology stack includes:

* Angular 1.5.x with ES6 modules
* RxJS
* Leaflet maps library
* jQuery and plugins like DataTables
* Gulp

## Getting started

Clone the project and `npm start`

The app will be served at: [http://localhost:8080](http://localhost:8080).

### Note on the data

**You should Avoid to load data from the real servers API during development!**

In order to be gentle on the API endpoint (at http://earthquake.usgs.gov/earthquakes/) some **dummy data** are used for development.

You can change this in the API endpoint URL in the `app/settings.js`.

**Use the real API only for production.**

