const nameform = document.querySelector("#name-form")
const url = 'http://127.0.0.1:3000/'

document.querySelector('#nameinput').showModal()

function GetMap() {
  const map = new Microsoft.Maps.Map('#map');
}

// create new game
nameform.addEventListener('submit', async function(evt){
  evt.preventDefault()
  document.querySelector("#nameinput").close()
  const name = document.querySelector("#name-input").value
  document.querySelector("#p_name").innerHTML = "Name: " + name
  const response = await fetch(`${url}/create_game/${name}/EFHK`)
  const result = await response.json()
  console.log(result)
});