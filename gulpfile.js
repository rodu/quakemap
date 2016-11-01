var gulp = require('gulp');
var babel = require('gulp-babel');
var rename = require('gulp-rename');

gulp.task('default', function(){
  return gulp.src('quakemap.js')
    .pipe(babel())
    .pipe(rename('quakemap.bundle.js'))
    .pipe(gulp.dest('.'));
});
