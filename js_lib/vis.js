var container = d3.select('body').append('div')
        .attr('id', 'container');

var svg = container.append("svg")
        .attr('id', 'graph')
        .attr('width', 2200)
        .attr('height', 1000);

var status = d3.select("body").append("p")
        .attr("id", "status");

// don't fill up the entire svg
var margin = {top: 20, right: 20, bottom: 30, left: 50};

// the actual width and height where plotting is allowed
var width = +svg.attr("width") - margin.left - margin.right;
var height = +svg.attr("height") - margin.top - margin.bottom;

// the current opened File object and the data loaded in memeory
var opened_f;
var loaded_data;

// the plotting time range, and the range moving step in day count
var begin, end, step;
// time parser and formatter, all un UTC
var tparser = d3.utcParse("%Y-%m-%d %Hh");
var tformatter = d3.utcFormat("%Y-%m-%d %Hh");

function datetimeSearch(arr, v) {
    // binary search that return the first index i with arr[i].epoch > v
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
    // given a Date, return a new day add by number of days indicted in days
    var result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

// once pressed the button, plot the data scoped by currently indicated date
var update = d3.select("input#update")
     .on('click', function() {
        d3.event.stopPropagation();
        d3.event.preventDefault();
        begin = tparser(document.getElementById("beginDate").value);
        end = tparser(document.getElementById("endDate").value);
        plot();
        return false;
    });

// once pressed the button, right shift (move forward in time) the currently indicated date range, then plot
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

// once pressed the button, right shift (go back in time) the currently indicated date range, then plot
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
        var f = file.files[0]; // get the first file selected by the file input
        if (f) {
            if (f != opened_f) {
                // only proceed if it differs from the file already opened
                d3.select("#status").text("Reading data file...");
                var reader = new FileReader();
                reader.onloadend = function(evt) {
                    var t1 = performance.now();
                    d3.select("#status").text(Math.round(f.size/(1048576)) + "MB loaded in " + parseFloat(Math.round((t1-t0) * 100) / 100).toFixed(2) + " milliseconds.\n Now scoping and plotting data...");
                    //console.log(f.name + ": " + Math.round(f.size/(1048576)) + "MB, " + parseFloat(Math.round((t1-t0) * 100) / 100).toFixed(2) + "msec");
                    opened_f = f;
                    try {
                        loaded_data = JSON.parse(evt.target.result); // read the file as text and parse it to JSON object
                    } catch (ex) {
                        console.error(ex);
                    }
                    // cannot merge with else clause: see http://stackoverflow.com/questions/13487437/change-global-variable-inside-javascript-closure
                    // event driven not sequential
                    svg.selectAll("*").remove();
                    drawlines(loaded_data);
                };
                var t0 = performance.now();
                reader.readAsText(f);
            } else {
                d3.select("#status").text("Scoping and plotting data...");
                svg.selectAll("*").remove(); // clean the canvas
                drawlines(loaded_data);
            }
        }
    }
}

function drawlines(data) {

    var t0 = performance.now();

    var first = true; // the axis of the first lien has different style form others
    var line_strength = 1; // the opacity of liens
    var plot_width = 2000; // the size of plot for each trace
    var plot_height = 450;

    // for each trace, a g will be created with following shift with regard to the svg
    // after plotting one trace, the shift will be correspondingly modified for the next plot
    // so that a perspective effect can be achieved
    var y_shift = height-plot_height-20;
    var x_shift = margin.left;

    var fade = 0.99; // the opacity of liens decreases at this rate
    var step = 8; // the shift of next plot from current one
    var perspective = 0.995; // the rate at which the above shift decreases trace after trace

    var pb_count = 0;

    var label_interval = 5; // indicate the axis label once a while

    var line = d3.line() // plot the line according to epoch and value attribute
    .x(function(d) {return x(d.epoch);} )
    .y(function(d) {return y(d.value);});

    var bg_epoch_msec = begin.getTime(); // begin and end time in milliseconds
    var ed_epoch_msec = end.getTime();
    //console.log(bg_epoch_msec + ":" + ed_epoch_msec);

    for (var pb in data) {
        if ((data[pb] !== undefined) && (data[pb] !== null)) {

            var data_to_plot = []; // copy the date to plot here

            bg_idx = datetimeSearch(data[pb], bg_epoch_msec); // for each probe trace the records is generally well sorted
            ed_idx = datetimeSearch(data[pb], ed_epoch_msec); // search for the index range for plot
            //console.log(pb + ":{bg_idx:" + bg_idx + ", ed_idx:" + ed_idx+"}");
            //console.log(pb + ":{bg_idx:" + data[pb][bg_idx].epoch + ", ed_idx:" + data[pb][ed_idx].epoch+", ed_idx-1:" + data[pb][ed_idx-1].epoch + "}")
            if (ed_idx > bg_idx && bg_idx >= 0) {
                for(var i = bg_idx; i < ed_idx; i++) {
                    var v = data[pb][i];
                    //var dt = new Date(v.epoch);
                    //dt.setUTCSeconds(v.epoch);
                    if ((v !== undefined) && (v !== null) && v.hasOwnProperty("value") && 0 < v.value && v.value < 800) {
                        // filter out records with extreme values
                        // could be something configurable globally
                        data_to_plot.push({epoch: v.epoch * 1000, value: v.value})
                        // in data the epoch is in second, while in js it should in milliseconds
                    }
                }
            }

            if (data_to_plot.length > 0) {
                pb_count += 1;

                // this is the g where axis and lines of each trace are plotted
                var g = svg.append("g")
                    .attr("transform", "translate(" + x_shift+ "," + y_shift + ")")
                    .attr("id", 't' + pb);

                // the range to plot in the above g
                var x = d3.scaleTime().rangeRound([0,  plot_width]);
                var y = d3.scaleLinear().rangeRound([plot_height, 0]);

                // the value range from data
                x.domain([bg_epoch_msec, ed_epoch_msec]);
                y.domain([0, 800]);

                // add x, y axis for each trace, x axis is at the bottom of the plot thus down shifted by the plot height
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
                    // if no longer the first plot, change a little bit the style
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

                // attach probe ID to the top of each y axis
                yaxis.append("text")
                    .attr("fill", "#000")
                    .attr("x", 0)
                    .attr("y", -6)
                    .attr("dy", "0.71em")
                    .attr("transform", "rotate(-90)")
                    .attr("text-anchor", "end")
                    .text(pb);

                // plot the trace
                g.append("path")
                    .datum(data_to_plot)
                    .attr("fill", "none")
                    .attr("stroke", "steelblue")
                    .attr("stroke-linejoin", "round")
                    .attr("stroke-linecap", "round")
                    .attr("stroke-width", 1.5)
                    .attr("opacity", Math.max(line_strength, 0.3))
                    .attr("d", line);

                // update the shift, the shift step, line opacity, plot size for next plot
                x_shift += step;
                y_shift = y_shift - step*0.8 + (1-perspective) * plot_height;
                line_strength *= fade;
                plot_height *= perspective;
                plot_width *= perspective;
                step *= perspective;
            }
        }
    }
    var t1 = performance.now();
    d3.select("#status").text(Object.keys(data).length + " probes scoped, " + pb_count + " plotted in "+ parseFloat(Math.round((t1-t0) * 100) / 100).toFixed(2) + " milliseconds. ");
}