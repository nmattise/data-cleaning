//jshint esversion: 6
var fs = require('fs');

var Timeseries = function(data) {
  this.series = data;
  return;
};
var steamData = new Timeseries(JSON.parse(fs.readFileSync('data/SteamData.json')));
var ElectricityData = new Timeseries(JSON.parse(fs.readFileSync('data/ElectricityData.json')));
var ChilledWaterData = new Timeseries(JSON.parse(fs.readFileSync('data/ChilledWaterOutlier.json')));
var WaterData = new Timeseries(JSON.parse(fs.readFileSync('data/WaterDataNegZero.json')));



Timeseries.prototype.setInterval = function() {
  var series = this.series;
  var i1 = new Date(series[0].timestamp);
  var i2 = new Date(series[1].timestamp);
  var i1End = new Date(series[series.length - 2].timestamp);
  var i2End = new Date(series[series.length - 1].timestamp);
  var int1 = i2 - i1;
  var int2 = i2End - i1End;
  this.interval = Math.min(int1, int2);
  return;
};

Timeseries.prototype.fillMissingAvg = function() {
  var series = this.series;
  var int = this.interval;
  var average = series.map(v => v.value).reduce((p, c) => p + c, 0) / series.length;
  var missed = [];
  for (var i = 0; i < series.length - 1; i++) {
    if ((new Date(series[i + 1].timestamp) - new Date(series[i].timestamp)) > int) {
      var start = new Date(series[i].timestamp).getTime() + int;
      var end = new Date(series[i + 1].timestamp).getTime();
      for (start; start < end; start += int) {
        missed.push({
          value: average,
          timestamp: new Date(start),
          correction: 'missing'
        });
        i++;
      }
    }
  }
  this.series = series.concat(missed);
  this.series.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  return;
};
Timeseries.prototype.fillMissingNext = function() {
  var series = this.series;
  var int = this.interval;
  var missed = [];
  for (var i = 0; i < series.length - 1; i++) {
    if ((new Date(series[i + 1].timestamp) - new Date(series[i].timestamp)) > int) {
      var start = new Date(series[i].timestamp).getTime() + int;
      var end = new Date(series[i + 1].timestamp).getTime();
      var avgValue = (series[i].value + series[i + 1].value) / 2;
      // console.log(new Date(series[i].timestamp), new Date(series[i + 1].timestamp), avgValue);
      for (start; start < end; start += int) {
        missed.push({
          value: avgValue,
          timestamp: new Date(start),
          correction: 'missing'
        });
        i++;
      }
    }
  }
  // console.log(missed);
  this.series = series.concat(missed);
  this.series.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  return;
};

Timeseries.prototype.cleanNegative = function() {
  for (var i = 0; i < this.series.length; i++) {
    if (this.series[i].value < 0) {
      this.series[i].ov = Object.assign({}, this.series[i]).value;
      this.series[i].value = 0;
      this.series[i].correction = 'neg';
    }
  }
};

Timeseries.prototype.outliers = function() {
  var justValues = this.series.map(v => v.value);
  justValues.sort((p, c) => p - c);
  var n = justValues.length;
  var median = justValues[Math.floor(0.5 * (n + 1))];
  if (median === 0) return;
  var q1 = justValues[Math.floor(0.25 * (n + 1))];
  var q3 = justValues[Math.floor(0.75 * (n + 1))];
  var iq = q3 - q1;
  var perct = 100;
  var limiter = 3;
  while (perct > 1) {
    var upperLimit = q3 + (limiter * iq);
    var lowerLimit = (q1 - (limiter * iq)) < 0 ? 0 : (q1 - (limiter * iq));
    var upperCount = justValues.filter(v => v > upperLimit);
    var lowerCount = justValues.filter(v => v < lowerLimit);
    perct = (upperCount.length / n) * 100;
    limiter++;
  }
  this.series = this.series.map(function(v) {
    if (v.value > upperLimit) {
      v.ov = v.value;
      v.correction = 'outlier';
      v.value = upperLimit;
      return v;
    } else {
      return v;
    }
  });
};



console.time("outlier");
// console.log(WaterData.series.length);
ElectricityData.setInterval();
console.log(WaterData.interval);
WaterData.cleanNegative();
console.log(WaterData.series.length);
WaterData.fillMissingNext();
console.log(WaterData.series.length);
WaterData.outliers();
console.log('Cleaned');
console.timeEnd("outlier");

console.log(WaterData.series);
