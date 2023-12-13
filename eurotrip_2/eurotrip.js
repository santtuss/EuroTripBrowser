const nameform = document.querySelector("#name-form")
const url = 'http://127.0.0.1:3000/'
let game_id = 0

document.querySelector('#nameinput').showModal()

const start_money = 2000
const start_range = 2000
const start_airport = "EFHK"
let MaxLoan = 200

let cur_money = start_money
let cur_range = start_range
let cur_airport = start_airport
let current_info = []
let LoanTaken = 0
let stamps = 0

// creates map
const map = L.map('map').setView([60.1699, 24.9384], 3);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    minZoom: 3,
    maxZoom: 15,
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
  document.querySelector("#moneyfield").innerHTML = `${cur_money} €`
  document.querySelector("#rangefield").innerHTML = `${cur_range} km`
  document.querySelector('#stampfield').innerHTML = `${stamps}/5`
  const this_fetch = await fetch(`${url}/get_airport_info/${cur_airport}`)
  current_info = await this_fetch.json()
  document.querySelector("#p_location").innerHTML = "Current Location: " + current_info['name']
  await ReCheck(cur_airport)
  await GoalCheck(cur_airport)
  CheckGameOver()
  await NoRangeLeft(cur_airport, cur_range)
  await PushpinsInRange(cur_airport, cur_range)
  ShowVisited()
  await fetch(`${url}/update_visited_status/${game_id}/${cur_airport}`)
}

// oli pakko tehdä erillinen funktio kauppaa ja pankkia varten, FlyTo tekee
// liikaa ylimääräisiä juttuja...
// hyväksyy myös negatiivisia numeroita
async function UpdateMoneyOrRange(range, money) {
  const response = await fetch(`${url}/update_location/${game_id}/${range}/${money}/${cur_airport}`)
  const result = await response.json()
  cur_money = result["money"]
  cur_range = result["range"]
  if (cur_range < 0) {
    await NoRangeLeft(cur_airport, cur_range)
  }
  if (cur_money < 0) {
    alert("You're out of money! HINT: You can take a loan")
  }
  document.querySelector("#moneyfield").innerHTML = `${cur_money} €`
  document.querySelector("#rangefield").innerHTML = `${cur_range} km`
}


// poistaa pushpinit, käytetään PushpinsInRange funktion sisällä
function RemoveMarkers(group) {
  group.eachLayer(function(layer) {
    group.removeLayer(layer['_leaflet_id'])
  })
}



// näyttää rangen sisällä olevat pushpinit + luo niihin napit joilla voi lentää paikkoihin
async function PushpinsInRange(loc, range){
  try {
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
  })}
  } catch(error) {
    console.log(error)
  }
}


// create new game
nameform.addEventListener('submit', async function(evt){
  evt.preventDefault()
  document.querySelector("#nameinput").close()
  helpDialog.showModal();
  const name = document.querySelector("#name-input").value
  document.querySelector("#p_name").innerHTML = "Name: " + name
  const response = await fetch(`${url}/create_game/${name}/EFHK`)
  const result = await response.json()
  game_id = result["game_id"]
  cur_money = start_money
  cur_range = start_range
  cur_airport = start_airport
  current_info = []
  LoanTaken = 0
  stamps = 0
  await FlyTo(start_range, start_money, start_airport)
});

// goal check argumenttina loc (sijainti)
// laitetaan flyTo loppupäähän, async
async function GoalCheck(loc) {
  const request = await fetch(`${url}/check_if_goal/${loc}`)
  const my_response = await request.json()
  if (my_response["has_goal"])
  {
    stamps++
    AddStamp(loc, stamps)
    document.querySelector('#stampfield').innerHTML = `${stamps}/5`
    if (stamps < 5){
      const achieved_dialog = document.querySelector('#stampAchievedDialog')
      achieved_dialog.showModal()
      setTimeout(function(){achieved_dialog.close()}, 2000)
    }
    if (stamps >= 5){
      console.log("win")
      const fireworksDialog = document.getElementById('fireworksDialog');
      fireworksDialog.showModal();

      const closeFireworksButton = document.getElementById('closeFireworksButton');
      closeFireworksButton.addEventListener('click', function () {
      fireworksDialog.close();});

    }
  }
  else {
    document.querySelector('#small-notification').style = 'color:#FF7058;'
    document.querySelector('#small-notification').innerHTML = `No goal here!`
    setTimeout(function(){
      document.querySelector('#small-notification').innerHTML = ``
    }, 5000)
  }
}

// re check argumemnttina loc (sijainti)
async function ReCheck(loc) {
  const request = await fetch(`${url}/re_info/${game_id}/${loc}`)
  const response = await request.json()
  if (response["re_id"] !== 0) {
    const reDialog = document.querySelector('#reDialog')
    const content = document.querySelector('#reDialogContent')
    document.querySelector('#cancelButtonRe').addEventListener('click', function(){
      reDialog.close()})
    content.innerHTML = `${response["re_title"]}<br>${response["re_description"]}<br>`
    console.log(response["effect"])
    if (response["effect"] === "range_budget") {
      cur_range = parseInt(cur_range) + response["value"]
      await UpdateMoneyOrRange(parseInt(cur_range), parseInt(cur_money))
    }
    else if (response["effect"] === "money_budget") {
      cur_money = parseInt(cur_money) + response["value"]
      await UpdateMoneyOrRange(parseInt(cur_range), parseInt(cur_money))
    }
    reDialog.showModal()
  }
  console.log(response)
}


// lisää visited kaupungit drop down listaan
function ShowVisited(){
    const dropdown = document.querySelector('#visited_dropdown')
    const listItems = document.createElement('option')
    listItems.innerHTML = current_info['name'];
    dropdown.appendChild(listItems)
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


// pankki

let MaxLoanLeft = MaxLoan - LoanTaken

const openBankDialogButton = document.querySelector('.button3');
    const bankDialog = document.getElementById('bankDialog');
    const TakeLoanButton = document.getElementById('TakeLoanButton');
    const cancelLoanButton = document.getElementById('cancelLoanButton');
    const LoanAmountDialog = document.getElementById('LoanAmountDialog');
    const confirmLoanButton = document.getElementById('confirmLoanButton');
    const cancelLoanButton2 = document.getElementById('cancelLoanButton2');

    openBankDialogButton.addEventListener('click', function () {
      document.querySelector('#maxloanleft').innerHTML = MaxLoanLeft.toString()
      bankDialog.showModal();
    });

    TakeLoanButton.addEventListener('click', function () {
      LoanAmountDialog.showModal();
      bankDialog.close();
    });

confirmLoanButton.addEventListener('click', async function() {
  const LoanAmountInput = document.getElementById('LoanAmount');
  const LoanAmount = parseInt(LoanAmountInput.value, 10);
  if (!isNaN(LoanAmount) && LoanAmount > 0 && LoanAmount <= MaxLoanLeft) {
    console.log('Taking loan of ' + LoanAmount + ' euros.');
    LoanTaken += LoanAmount
    MaxLoanLeft = MaxLoan - LoanTaken
    const new_money = parseInt(cur_money) + LoanAmount
    await UpdateMoneyOrRange(cur_range, new_money)
    LoanAmountDialog.close();
  } else {
    alert(`Enter a valid loan amount (1 - ${MaxLoanLeft}).`);
  }
});

    cancelLoanButton.addEventListener('click', function () {
      bankDialog.close();
    });

    cancelLoanButton2.addEventListener('click', function () {
      LoanAmountDialog.close();
    });

const openHelpDialogButton = document.getElementById('openHelpDialogButton');
const helpDialog = document.getElementById('helpDialog');
const moreInformationButton = document.getElementById('moreInformation');
const cancelHelpButton = document.getElementById('cancelHelpButton');
const moreInformationDialog = document.getElementById('moreInformationDialog');
const cancelButton2 = document.getElementById('cancelButton2');

openHelpDialogButton.addEventListener('click', function() {
    helpDialog.showModal();
});

moreInformationButton.addEventListener('click', function() {
    moreInformationDialog.showModal();
    helpDialog.close();
});

cancelHelpButton.addEventListener('click', function() {
    helpDialog.close();
});

cancelButton2.addEventListener('click', function() {
    moreInformationDialog.close();
});

const storyButton = document.getElementById('storyButton');
const cancelStoryButton = document.getElementById('cancelButton3');
const storyDialog = document.getElementById('storyDialog');

storyButton.addEventListener('click', function(){
  storyDialog.showModal();
})

cancelStoryButton.addEventListener('click', function(){
  helpDialog.close();
  storyDialog.close();
})

const GameOverDialog = document.getElementById('GameOverDialog');
const restartGame = document.getElementById('restartGame');
restartGame.addEventListener('click', function() {RestartGame()})

async function CheckGameOver(){
  if (cur_money <= 0 && LoanTaken <= MaxLoan && stamps < 5 && cur_range <= 0) {
    console.log('Game Over.');
    GameOverDialog.showModal();
  }
}

async function NoRangeLeft(loc, range) {
  const response = await fetch(`${url}/airports_in_range/${loc}/${range}`)
  console.log(response)
  const result = await response.json()
  console.log(result)
  if (result.length === 0){
    showAlert()
  }
}
function showAlert(){
  const customAlert = document.querySelector('#customAlert');
  customAlert.showModal()

  const buyRange = document.querySelector('#buyRange')
  buyRange.addEventListener('click',() => {
    customAlert.close();
    const range = document.querySelector('#openShopDialogButton')
    range.click();
  })


  const takeLoan = document.querySelector('#takeLoan')
  takeLoan.addEventListener('click',() => {
    customAlert.close();
    const range = document.querySelector('#openBankDialogButton')
    range.click();
  })

  const cancelButton = document.querySelector('#cancelAlertButton')
  cancelButton.addEventListener('click',() =>{
    customAlert.close();
  })
}

// restart game function
function RestartGame() {
  document.querySelector("#nameinput").showModal()
}

// restart button
const restartbutton = document.querySelector('#restartbutton')
restartbutton.addEventListener('click', function(){RestartGame()})

// darkmode button
const darkmodebtn = document.querySelector('#darkmodebtn');
const theme = document.querySelector('#theme-link');
darkmodebtn.addEventListener('click', function(){
  if (theme.getAttribute("href") === "light-theme.css") {
    theme.href = "dark-theme.css";
  } else {
    theme.href = "light-theme.css";
  }
});

const passportdialog = document.querySelector('#PassportDialog')
const cancel = document.querySelector('#cancelButtonPassport')
cancel.addEventListener('click', function(){passportdialog.close()})
document.querySelector('#travel_button').addEventListener('click', async function() {
  passportdialog.showModal()
});

function AddStamp(loc, i) {
  const slot = document.querySelector(`#slot${i}`)
  const label = document.querySelector(`#label${i}`)
  const source = `${current_info['municipality'].toLowerCase()}.png`
  label.innerHTML = `${current_info['municipality']}`
  const image = document.createElement('img')
  image.src = `stamps/${source}`
  image.width = 150
  image.height = 150
  slot.appendChild(image)
}