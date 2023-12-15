const nameform = document.querySelector("#name-form")
const url = 'http://127.0.0.1:3000/'
let game_id = 0

document.querySelector('#nameinput').showModal()

const start_money = 2000
const start_range = 2000
const start_airport = "EFHK"
let MaxLoan = 1000

let cur_money = start_money
let cur_range = start_range
let cur_airport = start_airport
let current_info = []
let LoanTaken = 0
let stamps = 0
let player_score = 0
let storyscoreswitch = false

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
  try {
    const response = await fetch(`${url}/update_location/${game_id}/${range}/${money}/${loc}`)
    const result = await response.json()
    cur_money = result["money"]
    cur_range = result["range"]
    cur_airport = result["location"]
  } catch(error) {
    console.log("Error")
  }
  document.querySelector("#moneyfield").innerHTML = `${cur_money} €`
  document.querySelector("#rangefield").innerHTML = `${cur_range} km`
  document.querySelector('#stampfield').innerHTML = `${stamps}/5`
  const this_fetch = await fetch(`${url}/get_airport_info/${cur_airport}`)
  current_info = await this_fetch.json()
  RemoveMarkers(markergroup)
  const redMarker = L.marker([current_info['latitude_deg'], current_info['longitude_deg']], { icon: redIcon }).addTo(markergroup);
  redMarker.bindPopup(`Current Location`);
  ZoomToLocation(current_info['latitude_deg'], current_info['longitude_deg']);
  document.querySelector("#p_location").innerHTML = "<b>Current Location:</b> " + current_info['name']
  if (await GoalCheck(cur_airport) !== "win") {
      await ReCheck(cur_airport)
      await NoRangeLeft(cur_airport, cur_range)
      await PushpinsInRange(cur_airport, cur_range)
      ShowVisited()
      await fetch(`${url}/update_visited_status/${game_id}/${cur_airport}`)
  }
}
async function ZoomToLocation(latitude, longitude) {
  map.flyTo([latitude, longitude], 5, {
    duration: 1,  // Set the duration of the animation in seconds
    animate: true,
  });
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
    if (MaxLoan > LoanTaken) {
      alert("You're out of money! HINT: You can take a loan")
    }
    else {
      CheckGameOver()
    }
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
}


// create new game
nameform.addEventListener('submit', async function(evt){
  evt.preventDefault()
  document.querySelector("#nameinput").close()
  helpDialog.showModal();
  const name = document.querySelector("#name-input").value
  document.querySelector("#p_name").innerHTML = "<b>Name: </b>" + name
  const response = await fetch(`${url}/create_game/${name}/EFHK`)
  const result = await response.json()
  game_id = result["game_id"]
  cur_money = start_money
  cur_range = start_range
  cur_airport = start_airport
  current_info = []
  LoanTaken = 0
  stamps = 0
  scoreUpdate('green', 0, `Welcome, ${name}!`, 3000)
  await FlyTo(start_range, start_money, start_airport)
});

// goal check argumenttina loc (sijainti)
// laitetaan flyTo loppupäähän, async
async function GoalCheck(loc) {
  const request = await fetch(`${url}/check_if_goal/${loc}`)
  const my_response = await request.json()
  const visited_request = await fetch(`${url}/check_if_visited/${game_id}/${loc}`)
  const my_visited_response = await visited_request.json()
  if (my_response["has_goal"] && !my_visited_response["visited"])
  {
    stamps++
    AddStamp(loc, stamps)
    document.querySelector('#stampfield').innerHTML = `${stamps}/5`
    if (stamps < 5){

      const achieved_dialog = document.querySelector('#stampAchievedDialog')
      const stampImage = document.querySelector('#stampImage');
      stampImage.src = `stamps/${current_info['municipality'].toLowerCase()}.png`;
      const cancel = document.querySelector('#stampAchievedCancel')
      cancel.addEventListener('click', function(){
        achieved_dialog.close()
      })
      achieved_dialog.showModal()
    }
    if (stamps >= 5){
      scoreUpdate('green', parseInt(cur_money) + parseInt(cur_range), `+${parseInt(cur_money) + parseInt(cur_range)} Leftover Money and Range Bonus`, 3000)
      const fireworksDialog = document.getElementById('fireworksDialog');
      fireworksDialog.showModal();
      await fetch(`${url}/update_score/${game_id}/${player_score}`)
      const newGameAfterWin = document.getElementById('newGame');
      newGameAfterWin.addEventListener('click', function() {
        fireworksDialog.close()
        RestartGame()})
      const scorebutton = document.querySelector('#scorebutton')
      scorebutton.addEventListener('click', async function() {
        await HighScoreView()
      })
      return "win"
    }
  }
  else {
    if (my_visited_response["visited"]) {
      document.querySelector('#small-notification').style = 'color:#2dd0b8;'
      document.querySelector('#small-notification').innerHTML = ` Welcome back!`
    }
    else if (cur_airport !== "EFHK") {
      document.querySelector('#small-notification').style = 'color:#FF7058;'
      document.querySelector('#small-notification').innerHTML = ` No stamp here!`
    }
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
          rangeAmountDialog.close();
          const new_range = parseInt(cur_range) + rangeAmount
          const new_money = parseInt(cur_money) - rangeAmount
          await UpdateMoneyOrRange(new_range, new_money)
          await PushpinsInRange(cur_airport, new_range)
        }
        else {
          alert('Not enough money!')
        }
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
    scoreUpdate('red', -250, "-250 Use your money responsibly...", 3000)
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
  if (!storyscoreswitch) {
    scoreUpdate('green', 500, "+500 Enjoyed the EuroTrip Story", 7000)
    storyscoreswitch = true
  }
    storyDialog.showModal();
})

cancelStoryButton.addEventListener('click', function(){
  helpDialog.close();
  storyDialog.close();
})

const GameOverDialog = document.getElementById('GameOverDialog');
const restartGame = document.getElementById('restartGame');
restartGame.addEventListener('click', function() {RestartGame()})




function CheckGameOver(){
  if (cur_money <= 0 && LoanTaken >= MaxLoan && stamps < 5) {
    GameOverDialog.showModal();
  }
}

async function NoRangeLeft(loc, range) {
  const response = await fetch(`${url}/airports_in_range/${loc}/${range}`)
  console.log(response)
  const result = await response.json()
  console.log(result)
  if (result.length === 0){
    await CheckGameOver()
    showAlert()
  }
}
function showAlert(){
  const customAlert = document.querySelector('#customAlert');
  customAlert.showModal()
  CheckGameOver()

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
  player_score = 0
  storyscoreswitch = false
  MaxLoanLeft = MaxLoan
  scoreUpdate('green', 0, '', 0)
  const listofdialogs = document.querySelectorAll('dialog')
  for (let i = 0; i < listofdialogs.length; i++) {
    listofdialogs[i].close()
  }
  const slots = document.querySelectorAll('.passportslot')
  console.log(slots)
  for (let i = 0; i < slots.length; i++) {
    slots[i].innerHTML = `<p class="label" id="label${i+1}"></p>`
    console.log(slots[i])
  }
  document.querySelector("#nameinput").showModal()
}

// restart button
const restartbutton = document.querySelector('#restartbutton')
restartbutton.addEventListener('click', function(){RestartGame()})

// darkmode button
const darkmodebtn = document.querySelector('#darkmodebtn');
const theme = document.querySelector('#theme-link');
darkmodebtn.addEventListener('click', function(){
  console.log(theme.getAttribute("href"))
  if (theme.getAttribute("href") === "light-theme.css") {
    theme.href = "dark-theme.css";
    darkmodebtn.innerHTML = "Light Mode"
  } else {
    theme.href = "light-theme.css";
    darkmodebtn.innerHTML = "Dark Mode"
  }
  console.log(theme.getAttribute("href"))
});

const passportdialog = document.querySelector('#PassportDialog')
const cancel = document.querySelector('#cancelButtonPassport')
cancel.addEventListener('click', function(){passportdialog.close()})
document.querySelector('#travel_button').addEventListener('click', async function() {
  passportdialog.showModal()
});

function AddStamp(loc, i) {
  scoreUpdate('green', 500, "+500 Found stamp!", 3000)
  const totalSlots = 7;
  let nextSlot = i;

  while (
    (nextSlot === 2 || nextSlot === 5) ||
    (document.querySelector(`#label${nextSlot}`) && document.querySelector(`#label${nextSlot}`).innerHTML !== '')
  ) {
    nextSlot++;
    if (nextSlot > totalSlots) {
      nextSlot = 1;
    }
  }
  const slot = document.querySelector(`#slot${nextSlot}`)
  const label = document.querySelector(`#label${nextSlot}`)
  const source = `${current_info['municipality'].toLowerCase()}.png`
  label.innerHTML = `${current_info['municipality']}`
  const image = document.createElement('img')
  image.src = `stamps/${source}`
  image.width = 150
  image.height = 150
  slot.appendChild(image)

  image.classList.add('stamped');

  image.addEventListener('animationend', function () {
    image.classList.remove('stamped');
  });
}

document.querySelector('#seepassportbutton').addEventListener('click', function(){
  document.querySelector('#travel_button').click()
})

document.querySelector('#openPassport').addEventListener('click', function(){
  document.querySelector('#stampAchievedDialog').close()
  document.querySelector('#travel_button').click()
})

function scoreUpdate(color, amount, message, timeout) {
  player_score = parseInt(player_score) + parseInt(amount)
  document.querySelector('#p_score').innerHTML = player_score
  if (color === "green") {
    document.querySelector('#score-notification').style = 'color:#4CDBC4;'
  }
  else if (color === "red") {
    document.querySelector('#score-notification').style = 'color:#FF7058;'
  }
  else {
    document.querySelector('#score-notification').style = `color:${color};`
  }
    document.querySelector('#score-notification').innerHTML = ` ${message}`
  setTimeout(function(){
    document.querySelector('#score-notification').innerHTML = ``}, timeout)
}

async function HighScoreView() {
  const scorefetch = await fetch(`${url}/high_scores`)
        const scoreresult = await scorefetch.json()
        const table = document.querySelector("#scoretable")
        table.innerHTML = ''
        for (let i = 0; i < scoreresult.length; i++) {
          const name = scoreresult[i]["screen_name"]
          const score = scoreresult[i]["score"]
          const row = document.createElement("tr")
          row.innerHTML = `<td class="tablenamelabel">${name}</td> <td>${score}</td>`
          table.appendChild(row)
        }

        const scoredialog = document.querySelector('#scoredialog')
        const cancelbutton = document.querySelector("#scorecancel")
        cancelbutton.addEventListener('click', function() {scoredialog.close()})
        const myscore = document.querySelector('#myscore')
        myscore.innerHTML = `Your Score: ${player_score}`
        scoredialog.showModal()
}

const footerscorebutton = document.querySelector('#highscorebutton')
footerscorebutton.addEventListener('click', async function(){
  await HighScoreView()
})