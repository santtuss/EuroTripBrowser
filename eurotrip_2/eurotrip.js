const nameform = document.querySelector("#name-form")
const url = 'http://127.0.0.1:3000/'
let game_id = 0

document.querySelector('#nameinput').showModal()

// creates map
const map = L.map('map').setView([60.1699, 24.9384], 3);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

async function FlyTo(range, money, loc) {
  const response = await fetch(`${url}/update_location/${game_id}/${range}/${money}/${loc}`)
  const result = await response.json()
  console.log(result)
}

async function PushpinsInRange(loc, range){
  const response = await fetch(`${url}/airports_in_range/${loc}/${range}`)
  const result = await response.json()
  for (let i = 0; i < result.length; i++) {
    const marker = L.marker([result[i]['latitude_deg'], result[i]['longitude_deg']]).addTo(map);
    const button = `<button type="button">Fly Here</button>`
    marker.bindPopup(`${result[i]['name']} <br> ${button}`)
  }
}

PushpinsInRange("UUEE", 800)

// create new game
nameform.addEventListener('submit', async function(evt){
  evt.preventDefault()
  document.querySelector("#nameinput").close()
  const name = document.querySelector("#name-input").value
  document.querySelector("#p_name").innerHTML = "Name: " + name
  const response = await fetch(`${url}/create_game/${name}/EFHK`)
  const result = await response.json()
  game_id = result["game_id"]
});
