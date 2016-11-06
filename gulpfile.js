var gulp = require('gulp');
var source = require('vinyl-source-stream');
var connect = require('gulp-connect');
var rollup = require('rollup-stream');
var concat = require('gulp-concat');

var HTML_FILES = ['index.html'];

gulp.task('html', function () {
  gulp.src(HTML_FILES).pipe(connect.reload());
});

gulp.task('vendors', function () {
  return gulp.src([
      './lib/jquery.min.js',
      './lib/jquery.dataTables.min.js',
      './lib/angular.min.js',
      './lib/angular-datatables.min.js',
      './lib/angular-datatables.bootstrap.min.js',
      'rc="./lib/bootstrap.min.js"></sc',
      './lib/lodash.min.js',
      './lib/rx.all.min.js',
      './lib/rx.dom.min.js',
      './lib/ie10-viewport-bug-workaround.js',
      './lib/leaflet.js'
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

gulp.task('build', ['vendors', 'bundle']);
gulp.task('development', ['build', 'serve', 'watch']);

gulp.task('default', ['build']);
