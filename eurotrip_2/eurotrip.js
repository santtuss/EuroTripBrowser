const nameform = document.querySelector("#name-form")
const url = 'http://127.0.0.1:3000/'
let game_id = 0

document.querySelector('#nameinput').showModal()

const start_money = 2000
const start_range = 2000
const start_airport = "EFHK"

let cur_money = start_money
let cur_range = start_range
let cur_airport = start_airport
let current_info = []

// creates map
const map = L.map('map').setView([60.1699, 24.9384], 3);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);
const markergroup = L.layerGroup().addTo(map)


// updatee pelaajan sijainnin rahan ja rangen
async function FlyTo(range, money, loc) {
  const response = await fetch(`${url}/update_location/${game_id}/${range}/${money}/${loc}`)
  const result = await response.json()
  cur_money = result["money"]
  cur_range = result["range"]
  cur_airport = result["location"]
  document.querySelector("#moneyfield").innerHTML = `Money:<br>${cur_money} €`
  document.querySelector("#rangefield").innerHTML = `Range:<br>${cur_range} km`
  const this_fetch = await fetch(`${url}/get_airport_info/${cur_airport}`)
  current_info = await this_fetch.json()
  document.querySelector("#p_location").innerHTML = "Current Location: " + current_info['name']
  await fetch(`${url}/update_visited_status/${game_id}/${cur_airport}`)
  await PushpinsInRange(cur_airport, cur_range)
  ShowVisited()
}

// oli pakko tehdä erillinen funktio kauppaa ja pankkia varten, FlyTo tekee
// liikaa ylimääräisiä juttuja...
// hyväksyy myös negatiivisia numeroita
async function UpdateMoneyOrRange(range, money) {
  const response = await fetch(`${url}/update_location/${game_id}/${range}/${money}/${cur_airport}`)
  const result = await response.json()
  cur_money = result["money"]
  cur_range = result["range"]
  document.querySelector("#moneyfield").innerHTML = `Money:<br>${cur_money} €`
  document.querySelector("#rangefield").innerHTML = `Range:<br>${cur_range} km`
}


// poistaa pushpinit, käytetään PushpinsInRange funktion sisällä
function RemoveMarkers(group) {
  group.eachLayer(function(layer) {
    group.removeLayer(layer['_leaflet_id'])
  })
}

// näyttää rangen sisällä olevat pushpinit + luo niihin napit joilla voi lentää paikkoihin
async function PushpinsInRange(loc, range){
  RemoveMarkers(markergroup)
  const redMarker = L.marker([current_info['latitude_deg'], current_info['longitude_deg']], { icon: redIcon }).addTo(markergroup);
  redMarker.bindPopup(`Current Location`);
  const response = await fetch(`${url}/airports_in_range/${loc}/${range}`)
  const result = await response.json()
  for (let i = 0; i < result.length; i++) {


    const marker = L.marker([result[i]['latitude_deg'], result[i]['longitude_deg']]);
    markergroup.addLayer(marker).addTo(map)
    const distance = await fetch(`${url}/get_distance/${cur_airport}/${result[i]['ident']}`)
    const distance_result = await distance.json()
    const distance_int = Math.floor(distance_result['distance'] + 1)

    const button = document.createElement('button')
    button.innerHTML = `Fly Here`
    button.class = "flybutton"
    button.name = result[i]['ident']
    const popuphtml = document.createElement('p')
    popuphtml.innerHTML = `${result[i]['name']}<br>${distance_int} km away<br>`
    popuphtml.appendChild(button)
    marker.bindPopup(popuphtml)

    // tapahtuu kun klikkaa 'fly here' nappia
    button.addEventListener('click', async function() {

    await FlyTo((cur_range - distance_int), cur_money, result[i]['ident'])
})
  }
}


// create new game
nameform.addEventListener('submit', async function(evt){
  evt.preventDefault()
  document.querySelector("#nameinput").close()
  const name = document.querySelector("#name-input").value
  document.querySelector("#p_name").innerHTML = "Name: " + name
  const response = await fetch(`${url}/create_game/${name}/EFHK`)
  const result = await response.json()
  game_id = result["game_id"]
  await FlyTo(start_range, start_money, start_airport)
});


// (joonas) showvisited
// ei oo enään async
function ShowVisited(){
    const dropdown = document.querySelector('#visited_dropdown')
    const listItems = document.createElement('option')
    listItems.innerHTML = current_info['name'];
    dropdown.appendChild(listItems)
}

// current location
document.querySelector('.button1').addEventListener('click', async function() {
  RemoveMarkers(markergroup)
  const gameCoordinates = await getCoordinatesForLocation(cur_airport);
  const redMarker = L.marker(gameCoordinates, { icon: redIcon }).addTo(map);
  redMarker.bindPopup(`Current Location`).openPopup();
});


// MUOKKAA!!!!!!!!!!!!!!
async function getCoordinatesForLocation(location) {
  const coord_request = await fetch(`${url}/get_airport_info/${location}`)
  const coord_response = await coord_request.json()
  const lat = current_info["latitude_deg"]
  const lon = current_info["longitude_deg"]
  return [lat, lon];
}

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.0.0/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});


// shop
const openShopDialogButton = document.getElementById('openShopDialogButton');
const shopDialog = document.getElementById('shopDialog');
const buyRangeButton = document.getElementById('buyRangeButton');
const cancelBuyButton = document.getElementById('cancelBuyButton');
const rangeAmountDialog = document.getElementById('rangeAmountDialog');
const confirmBuyButton = document.getElementById('confirmBuyButton');
const cancelBuyButton2 = document.getElementById('cancelBuyButton2');

    openShopDialogButton.addEventListener('click', function() {
      shopDialog.showModal();
    });

    buyRangeButton.addEventListener('click', function() {
      rangeAmountDialog.showModal();
      shopDialog.close();
    });

    confirmBuyButton.addEventListener('click', async function() {
      const rangeAmountInput = document.getElementById('rangeAmount');
      const rangeAmount = parseInt(rangeAmountInput.value, 10);

      if (!isNaN(rangeAmount) && rangeAmount > 0) {
        if (rangeAmount <= cur_money) {
          // HINTASÄÄTÖ
          const new_range = parseInt(cur_range) + rangeAmount
          const new_money = parseInt(cur_money) - rangeAmount
          await UpdateMoneyOrRange(new_range, new_money)
          await PushpinsInRange(cur_airport, new_range)
        }
        else {
          alert('Not enough money!')
        }
        rangeAmountDialog.close();
      } else {
        alert('Enter a valid amount.');
      }
    });

    cancelBuyButton.addEventListener('click', function() {
      shopDialog.close();
    });

    cancelBuyButton2.addEventListener('click', function() {
      rangeAmountDialog.close();
    });