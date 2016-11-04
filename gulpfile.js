var gulp = require('gulp');
var source = require('vinyl-source-stream');
var connect = require('gulp-connect');
var rollup = require('rollup-stream');

var HTML_FILES = ['index.html'];

gulp.task('html', function () {
  gulp.src(HTML_FILES).pipe(connect.reload());
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
})

gulp.task('watch', function () {
  gulp.watch('./app/**/*.js', ['bundle']);
  gulp.watch(HTML_FILES, ['html']);
});

gulp.task('development', ['bundle', 'serve', 'watch']);

gulp.task('default', ['bundle'])
