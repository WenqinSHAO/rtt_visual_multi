//container of svg
var container = d3.select('body').append('div')
        .attr('id', 'container');

var svg = container.append("svg")
        .attr('id', 'graph')
        .attr('width', 2200)
        .attr('height', 1000);

var status = d3.select("body").append("p")
        .attr("id", "status");

var margin = {top: 20, right: 20, bottom: 30, left: 50};

//var g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

var width = +svg.attr("width") - margin.left - margin.right;
var height = +svg.attr("height") - margin.top - margin.bottom;

var begin, end, step;
var tparser = d3.utcParse("%Y-%m-%d %Hh");
var tformatter = d3.utcFormat("%Y-%m-%d %Hh");

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
            var reader = new FileReader();
            reader.onloadend = function(evt) {
                d3.select("#status").text("Filtering probe trace by datetime...");
                var dataUrl = evt.target.result;
                // The following call results in an "Access denied" error in IE.
                // heard that readAsText might help.
                // http://bl.ocks.org/hlvoorhees/9d58e173825aed1e0218
                // clean the svg
                svg.selectAll("*").remove();
                // handle new data from file
                drawlines(dataUrl);
            };
            reader.readAsDataURL(f);
        }
    }
}

function drawlines(dataUrl) {

    d3.json(dataUrl, function(data) {

        var line = d3.line()
        .x(function(d) {return x(d.epoch);} )
        .y(function(d) {return y(d.value);});

        var first = true;
        var line_strength = 1;
        var plot_width = 2000;
        var plot_height = 450;


        var y_shift = height-plot_height-20;
        //var y_shift = 400;
        var x_shift = margin.left;

        var fade = 0.99;
        var step = 15;
        var perspective = 0.99;

        var pb_count = 0;

        var label_interval = 5;


        for (var pb in data) {
            if ((data[pb] !== undefined) && (data[pb] !== null)) {
                var i = data[pb].length
                while (i--) {
                    v = data[pb][i];
                    dt = new Date(v.epoch);
                    dt.setUTCSeconds(v.epoch);
                    if (dt <= begin || dt >= end || v.value > 800 || v.value < 0) {
                        data[pb].splice(i, 1);
                    } else {
                        data[pb][i].epoch = dt;
                    }
                }

                if (data[pb].length > 0) {
                    pb_count += 1;
                    var g = svg.append("g")
                        .attr("transform", "translate(" + x_shift+ "," + y_shift + ")")
                        .attr("id", 't' + pb);

                    //console.log('#' + pb);
                    /*
                    MG.data_graphic({
                        data: data[pb],
                        width: 1200,
                        height: 500,
                        target: 'g#t' + pb.toString(),
                        //target: 'svg#graph',
                        x_accessor: 'epoch',
                        y_accessor: 'min_rtt',
                        area: false,
                        utc_time: true,
                        x_axis: true,
                        y_axis: false,
                        max_y: 800,
                        min_x: begin,
                        max_x: end
                    });
                    */



                    var x = d3.scaleTime().rangeRound([0,  plot_width]);
                    var y = d3.scaleLinear().rangeRound([plot_height, 0]);

                    x.domain([begin, end]);
                    y.domain([0, 800]);

                    var xaxis = g.append("g").attr("transform", "translate(0," + plot_height+ ")").call(d3.axisBottom(x));
                        xaxis.selectAll("text").attr("transform", "rotate(-30)");
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
                            xaxis.selectAll("text")
                                .attr("transform", "rotate(-30)");
                        }
                    }

                    yaxis.append("text")
                        .attr("fill", "#000")
                        .attr("x", 4)
                        .attr("y", 6)
                        .attr("dy", "0.71em")
                        .attr("transform", "rotate(-90)")
                        .attr("text-anchor", "end")
                        .text(pb);

                    g.append("path")
                        .datum(data[pb])
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
                }
            }
        }
        d3.select("#status").text(pb_count + " probe plotted.");
    });

}