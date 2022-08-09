
///// 1. Base settings /////

// set coordinates
const coordinates = [49.951636104235455, 36.3133995426642];
// create a map
let mymap = L.map('map', { zoomControl: false }).setView(coordinates, 2);
new L.Control.Zoom({ position: 'bottomright' }).addTo(mymap);
L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
  maxZoom: 17,
  attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
}).addTo(mymap);

///// 2. Get dynamic coordinates /////

// event on a map itself
mymap.on('mousemove', function (e) {
  const text = document.getElementById('text');
  text.innerHTML = (Math.round(e.latlng.lat * 100) / 100).toFixed(2) + ", " + (Math.round(e.latlng.lng * 100) / 100).toFixed(2);
});

///// 3. Set the more information window /////

// control information window
const info = document.querySelector('.info');
info.addEventListener('click', (e) => {
  if (e.target.id === "infoBlock") {
    info.classList.length === 1 ? info.classList.add("infoClicked") : info.classList.remove("infoClicked");
  }
})

///// 4. Add geoJSON /////

// put the geoJSON properties to the select values
let countries = [];
let pointsEarthquakes = [];
worldBorders.features.forEach( feature => {
  let option = document.createElement("option");
  option.text = feature.properties.ADMIN;
  document.querySelector('#countries').add(option);
})
document.querySelector('#countries').addEventListener('change', (e) => {
  worldBorders.features.forEach(feature => {
    if(feature.properties.ADMIN === e.target.value) {
      document.querySelector('#country').innerHTML = `${feature.properties.ADMIN} (${feature.properties.ISO_A3})`;
    }
  }) 
})
// add geoJSON
let worldBordersGeoJSON = L.geoJSON(worldBorders, {
  style: function (feature) {
    return {
      color: '#000',
      weight: 0.2,
      fillOpacity: 0
    }
  },
  onEachFeature: function (feature, layer) {
    layer.on('mouseover', () => {
      let points = turf.points(pointsEarthquakes);
      let totalPoints = 0;
        layer.feature.geometry.coordinates.forEach( coords => {
          let searchWithin = turf.polygon(coords);
          let ptsWithin = turf.pointsWithinPolygon(points, searchWithin);
          totalPoints += ptsWithin.features.length;
        })
      console.log(totalPoints)
      document.querySelector('#countries').value = '(no values selected)';
      document.querySelector('#country').innerHTML = `${layer.feature.properties.ADMIN} (${layer.feature.properties.ISO_A3}) - ${totalPoints}`;
      layer.setStyle({ fillOpacity: 0.5 })
    });
    layer.on('mouseout', () => {
      document.querySelector('#country').innerHTML = ``;
      layer.setStyle({ fillOpacity: 0 })
    })
  }
});
worldBordersGeoJSON.addTo(mymap);

///// 5. Send requests /////

// function to create dynamic html
const createElements = () => {
  const textFilter = document.createElement("p");
  const textnode = document.createTextNode("Filter");
  textFilter.appendChild(textnode);
  document.querySelector('#infoBlock').appendChild(textFilter);
  const createdFilter = document.createElement("input");
  const att1 = document.createAttribute("id");
  att1.value = "filter";
  createdFilter.setAttributeNode(att1);
  const att2 = document.createAttribute("autocomplete");
  att2.value = "off";
  createdFilter.setAttributeNode(att2);
  document.querySelector('#infoBlock').appendChild(createdFilter);
  const sliderDiv = document.createElement("div");
  const att3 = document.createAttribute("id");
  att3.value = "slider";
  sliderDiv.setAttributeNode(att3);
  document.querySelector('#infoBlock').appendChild(sliderDiv);
}

const filterResults = (filterObj) => {
  document.querySelector('#filter').addEventListener('keyup', (e) => {
    const value = e.target.value;
    filterObj.text = value;
    if (earthQuakes) {
      if (!isNaN(value)) {
        earthQuakes.eachLayer((layer) => {
          filterFunction(layer, filterObj);
        })
      }
    }
  })
}

const createSlider = (filterObj) => {
  const slider = document.querySelector('#slider');
  noUiSlider.create(slider, {
    tooltips: true,
    start: [filterObj.range[0], filterObj.range[1]],
    connect: true,
    range: {
      'min': filterObj.range[0],
      'max': filterObj.range[1]
    }
  }).on('slide', e => {
    filterObj.range = [parseFloat(e[0]), parseFloat(e[1])]
    earthQuakes.eachLayer((layer) => {
      filterFunction(layer, filterObj);
    })
  });
}

const filterFunction = (layer, filterObj) => {
  let isFound = 0;
  if(filterObj.text === '' || parseFloat(filterObj.text) < layer.feature.properties.mag) {
    isFound += 1;
  }
  if(layer.feature.properties.mag > filterObj.range[0] && layer.feature.properties.mag < filterObj.range[1]) {
    isFound += 1;
  }
  if(isFound === 2) {
    layer.addTo(mymap);
  } else {
    mymap.removeLayer(layer);
  }
}

const processing = (filterObj) => {
  createElements();
  filterResults(filterObj);
  createSlider(filterObj);
}

// send request for world borders
let earthQuakes;
const sendRequest = document.querySelector('#request');
sendRequest.addEventListener('click', (e) => {
  let option = document.querySelector('#selectEarthquake').value;
  fetch(`https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_${option}.geojson`)
    .then(response => {
      if (response.ok) {
        response.json()
          .then(data => {
            var filterObj = {
              text: '',
              range: [0, 0]
            }
            earthQuakes = L.geoJSON(data, {
              pointToLayer: function (geoJSONPoint, latlng) {
                if (geoJSONPoint.properties.mag < filterObj.range[0]) {
                  filterObj.range[0] = geoJSONPoint.properties.mag;
                }
                if (geoJSONPoint.properties.mag > filterObj.range[1]) {
                  filterObj.range[1] = geoJSONPoint.properties.mag;
                }
                return L.circle(latlng, { radius: 50000 * (geoJSONPoint.properties.mag) });
              },
              style: function (feature) {
                return {
                  fillOpacity: 0.3,
                  fillColor: '#000',
                  color: '#000',
                  opacity: 0.3
                }
              },
              onEachFeature: function (feature, layer) {
                pointsEarthquakes.push(layer.feature.geometry.coordinates);
                layer.on('mouseover', function () {
                  layer.setStyle({ fillOpacity: 1 });
                })
                layer.on('mouseout', function () {
                  layer.setStyle({ fillOpacity: 0.3 });
                })
              }

            }).bindPopup(function (layer) {
              return layer.feature.properties.mag.toString();
            }).addTo(mymap);
            processing(filterObj);
          })
      }
    })

})
