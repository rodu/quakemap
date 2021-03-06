var gulp = require('gulp');
var source = require('vinyl-source-stream');
var connect = require('gulp-connect');
var rollup = require('rollup-stream');
var concat = require('gulp-concat');

var HTML_FILES = ['index.html'];

gulp.task('html', function () {
  gulp.src(HTML_FILES).pipe(connect.reload());
});

gulp.task('concat-css', function () {
  return gulp.src([
      './lib/bootstrap.min.css',
      './lib/ie10-viewport-bug-workaround.css',
      './lib/non-responsive.css',
      './lib/leaflet.css',
      './lib/angular-datatables.min.css',
      './lib/datatables.bootstrap.min.css'
    ])
    .pipe(concat('vendors.bundle.css'))
    .pipe(gulp.dest('.'));
});

gulp.task('concat-scripts', function () {
  return gulp.src([
      './lib/jquery.min.js',
      './lib/jquery.dataTables.min.js',
      './lib/angular.min.js',
      './lib/angular-datatables.min.js',
      './lib/angular-datatables.bootstrap.min.js',
      //'./lib/bootstrap.min.js',
      './lib/rx.all.min.js',
      './lib/rx.dom.min.js',
      './lib/leaflet.js',
      './lib/polyfill.min.js'
    ])
    .pipe(concat('vendors.bundle.js'))
    .pipe(gulp.dest('.'));
});

gulp.task('serve', function() {
  connect.server({
    port: 8080,
    livereload: true
  });
});

gulp.task('bundle', function () {
  return rollup('./rollup.config')
    .pipe(source('quakemap.bundle.js'))
    .pipe(gulp.dest('.'))
    .pipe(connect.reload());
});

gulp.task('watch', function () {
  gulp.watch('./app/**/*.js', ['bundle']);
  gulp.watch(HTML_FILES, ['html']);
});

gulp.task('vendors', ['concat-scripts', 'concat-css']);

gulp.task('build', ['vendors', 'bundle']);

gulp.task('development', ['build', 'serve', 'watch']);

gulp.task('default', ['build']);
