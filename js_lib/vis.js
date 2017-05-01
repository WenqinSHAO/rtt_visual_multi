var container = d3.select('body').append('div')
        .attr('id', 'container');

var svg = container.append("svg")
        .attr('id', 'graph')
        .attr('width', 2200)
        .attr('height', 1000);

var status = d3.select("body").append("p")
        .attr("id", "status");

var margin = {top: 20, right: 20, bottom: 30, left: 50};

var width = +svg.attr("width") - margin.left - margin.right;
var height = +svg.attr("height") - margin.top - margin.bottom;

var opened_f;
var loaded_data;

var begin, end, step;
var tparser = d3.utcParse("%Y-%m-%d %Hh");
var tformatter = d3.utcFormat("%Y-%m-%d %Hh");

function datetimeSearch(arr, v) {
    // binary search that return the first index with arr[i].epoch > v
    var low = 0;
    var high = arr.length;
    var mid;
    while (low < high) {
        mid = Math.floor((low+high)/2);
        if ((arr[mid].epoch * 1000) <= v) {
            low = mid + 1;
        } else {
            high = mid;
        }
    }
    return high;
}

function addDays(date, days) {
    var result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

var update = d3.select("input#update")
     .on('click', function() {
        d3.event.stopPropagation();
        d3.event.preventDefault();
        begin = tparser(document.getElementById("beginDate").value);
        end = tparser(document.getElementById("endDate").value);
        plot();
        return false;
    });

var next = d3.select("input#next")
    .on('click', function() {
        d3.event.stopPropagation();
        d3.event.preventDefault();

        begin = tparser(document.getElementById("beginDate").value);
        end = tparser(document.getElementById("endDate").value);

        step = parseInt(document.getElementById("daystep").value)

        begin = addDays(begin, step);
        end = addDays(end, step);

        document.getElementById("beginDate").value = tformatter(begin);
        document.getElementById("endDate").value = tformatter(end);

        plot();

        return false;
    });

var previous = d3.select("input#previous")
    .on('click', function() {
        d3.event.stopPropagation();
        d3.event.preventDefault();
        begin = tparser(document.getElementById("beginDate").value);
        end = tparser(document.getElementById("endDate").value);

        step = parseInt(document.getElementById("daystep").value)

        begin = addDays(begin, -1*step);
        end = addDays(end, -1*step);
        document.getElementById("beginDate").value = tformatter(begin);
        document.getElementById("endDate").value = tformatter(end);

        plot();

        return false;
    });

function plot() {
    var file = document.getElementById("file_input");
    if ('files' in file && file.files.length > 0) {
        var f = file.files[0];
        if (f) {
            if (f != opened_f) {
                d3.select("#status").text("Reading data file...");
                var reader = new FileReader();
                reader.onloadend = function(evt) {
                    var t1 = performance.now();
                    d3.select("#status").text(Math.round(f.size/(1048576)) + "MB loaded in " + parseFloat(Math.round((t1-t0) * 100) / 100).toFixed(2) + " milliseconds.\n Now scoping and plotting data...");
                    //console.log(f.name + ": " + Math.round(f.size/(1048576)) + "MB, " + parseFloat(Math.round((t1-t0) * 100) / 100).toFixed(2) + "msec");
                    opened_f = f;
                    try {
                        loaded_data = JSON.parse(evt.target.result);
                    } catch (ex) {
                        console.error(ex);
                    }
                    // cannot merge with else clause: see http://stackoverflow.com/questions/13487437/change-global-variable-inside-javascript-closure
                    svg.selectAll("*").remove();
                    drawlines(loaded_data);
                };
                var t0 = performance.now();
                reader.readAsText(f);
            } else {
                d3.select("#status").text("Scoping and plotting data...");
                svg.selectAll("*").remove();
                drawlines(loaded_data);
            }
        }
    }
}

function drawlines(data) {

    var t0 = performance.now();

    var first = true;
    var line_strength = 1;
    var plot_width = 2000;
    var plot_height = 450;

    var y_shift = height-plot_height-20;
    var x_shift = margin.left;

    var lab_x = 2;

    var fade = 0.99;
    var step = 8;
    var perspective = 0.995;

    var pb_count = 0;

    var label_interval = 5;

    var line = d3.line()
    .x(function(d) {return x(d.epoch);} )
    .y(function(d) {return y(d.value);});

    var bg_epoch_msec = begin.getTime();
    var ed_epoch_msec = end.getTime();
    //console.log(bg_epoch_msec + ":" + ed_epoch_msec);

    for (var pb in data) {
        if ((data[pb] !== undefined) && (data[pb] !== null)) {

            var data_to_plot = [];

            bg_idx = datetimeSearch(data[pb], bg_epoch_msec);
            ed_idx = datetimeSearch(data[pb], ed_epoch_msec);
            //console.log(pb + ":{bg_idx:" + bg_idx + ", ed_idx:" + ed_idx+"}");
            //console.log(pb + ":{bg_idx:" + data[pb][bg_idx].epoch + ", ed_idx:" + data[pb][ed_idx].epoch+", ed_idx-1:" + data[pb][ed_idx-1].epoch + "}")
            if (ed_idx > bg_idx && bg_idx >= 0) {
                for(var i = bg_idx; i < ed_idx; i++) {
                    var v = data[pb][i];
                    //var dt = new Date(v.epoch);
                    //dt.setUTCSeconds(v.epoch);
                    if ((v !== undefined) && (v !== null) && v.hasOwnProperty("value") && 0 < v.value && v.value < 800) {
                        data_to_plot.push({epoch: v.epoch * 1000, value: v.value})
                    }
                }
            }

            if (data_to_plot.length > 0) {
                pb_count += 1;
                var g = svg.append("g")
                    .attr("transform", "translate(" + x_shift+ "," + y_shift + ")")
                    .attr("id", 't' + pb);

                var x = d3.scaleTime().rangeRound([0,  plot_width]);
                var y = d3.scaleLinear().rangeRound([plot_height, 0]);

                x.domain([bg_epoch_msec, ed_epoch_msec]);
                y.domain([0, 800]);

                var xaxis = g.append("g").attr("transform", "translate(0," + plot_height+ ")").call(d3.axisBottom(x).tickFormat(tformatter));
                    /*
                    xaxis.selectAll("text")
                        .style("text-anchor", "end")
                        .attr("dx", "-.8em")
                        .attr("dy", ".15em")
                        .attr("transform", "rotate(-65)");*/
                var yaxis = g.append("g").call(d3.axisLeft(y));

                if (first) {
                    first = false;
                } else {

                    xaxis.selectAll("*")
                        .attr("opacity", Math.max(line_strength, 0.3)*0.8);

                    yaxis.selectAll("*")
                        .attr("opacity", Math.max(line_strength, 0.3)*0.8);

                    if (pb_count % label_interval != 0) {
                        xaxis.selectAll("text").remove();
                        yaxis.selectAll("text").remove();
                    } else {
                        xaxis.selectAll(".tick").attr("opacity", 0.6);
                        yaxis.selectAll(".tick").attr("opacity", 0.6);
                        //xaxis.selectAll("text")
                        //    .attr("transform", "rotate(-30)");
                    }
                }

                yaxis.append("text")
                    .attr("fill", "#000")
                    .attr("x", 0)
                    .attr("y", -6)
                    .attr("dy", "0.71em")
                    .attr("transform", "rotate(-90)")
                    .attr("text-anchor", "end")
                    .text(pb);

                g.append("path")
                    .datum(data_to_plot)
                    .attr("fill", "none")
                    .attr("stroke", "steelblue")
                    .attr("stroke-linejoin", "round")
                    .attr("stroke-linecap", "round")
                    .attr("stroke-width", 1.5)
                    .attr("opacity", Math.max(line_strength, 0.3))
                    .attr("d", line);

                x_shift += step;
                y_shift = y_shift - step*0.8 + (1-perspective) * plot_height;
                line_strength *= fade;
                plot_height *= perspective;
                plot_width *= perspective;
                step *= perspective;
                lab_x *= perspective;
            }
        }
    }
    var t1 = performance.now();
    d3.select("#status").text(Object.keys(data).length + " probes scoped, " + pb_count + " plotted in "+ parseFloat(Math.round((t1-t0) * 100) / 100).toFixed(2) + " milliseconds. ");
}