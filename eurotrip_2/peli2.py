import random
from geopy import distance
import mysql.connector
import story
import json
from flask import Flask
from database import Database
from flask_cors import CORS

db = Database()
app = Flask(__name__)
cors = CORS(app)
app.config['CORS_HEADERS'] = 'Content-Type'
conn = db.get_conn()


@app.route('/get_encounters')
def get_encounters():
    sql = "SELECT * FROM random_encounters;"
    cursor = conn.cursor(dictionary=True)
    cursor.execute(sql)
    result = cursor.fetchall()
    return json.dumps(result)


@app.route('/get_airports')
def get_airports():
    sql = "SELECT * FROM airport;"
    cursor = conn.cursor(dictionary=True)
    cursor.execute(sql)
    result = cursor.fetchall()
    return json.dumps(result)


@app.route('/random_goal')
def random_goal():
    sql = "SELECT goal_id FROM goal ORDER BY RAND() LIMIT 1;"
    cursor = conn.cursor(dictionary=True)
    cursor.execute(sql)
    result = cursor.fetchone()
    return json.dumps(result['goal_id'])


@app.route('/get_airport_info/<icao>')
def get_airport_info(icao):
    sql = f'''SELECT iso_country, ident, name, latitude_deg, longitude_deg, population, is_capital, passengers
            FROM airport WHERE ident = %s'''
    cursor = conn.cursor(dictionary=True)
    cursor.execute(sql, (icao,))
    result = cursor.fetchone()
    return json.dumps(result)


@app.route('/check_if_visited/<game_id>/<current_location>')
def check_if_visited(game_id, current_location):
    # "SELECT EXISTS" kokeilee, onko olemassa riviä, joka toteuttaa sulkujen sisällä olevat ehdot
    # jos ei ole, se palauttaa 0, jos on, se palauttaa 1
    sql = f'SELECT EXISTS(SELECT * from visited_city WHERE id_game = %s AND location = %s)'
    cursor = conn.cursor(dictionary=True)
    cursor.execute(sql, (game_id, current_location,))
    fetched = cursor.fetchone()
    # list() tekee sql syöttämästä taulukosta python listan
    result = list(fetched.values())[0]
    return str(result)


@app.route('/check_if_goal/<player_location>')
def check_if_goal(player_location):
    check = 0
    sql = f'SELECT DISTINCT municipality, ident, population FROM airport ORDER BY population DESC LIMIT 31;'
    cursor = conn.cursor(dictionary=True)
    cursor.execute(sql)
    correct_ports = cursor.fetchall()
    for port in correct_ports:
        if port['ident'] == player_location:
            check = 1
    return json.dumps(check)


@app.route('/check_if_re/<game_id>/<player_location>')
def check_if_re(game_id, player_location):
    check = 0
    print('testi 1', check_if_visited(game_id, player_location))
    if check_if_visited(game_id, player_location) == 1:
        check = 2
    else:
        sql = 'SELECT EXISTS (SELECT el_encounter FROM encounter_location WHERE el_game = %s AND el_location = %s);'
        cursor = conn.cursor(dictionary=True)
        cursor.execute(sql, (game_id, player_location,))
        fetched = cursor.fetchone()
        result = list(fetched.values())[0]
        if result == 1:
            check = 1
    return str(check)


@app.route('/check_which_re/<game_id>/<location>')
def check_which_re(game_id, location):
    print(check_if_re(game_id, location))
    if check_if_re(game_id, location)[0] == 1:
        print("ok")
        sql = f'SELECT el_encounter FROM encounter_location WHERE el_game = %s AND el_location = %s;'
        cursor = conn.cursor(dictionary=True)
        cursor.execute(sql, (game_id, location,))
        result = cursor.fetchone()
        print(result)
        return json.dumps(result['el_encounter'])
    else:
        return json.dumps(0)



if __name__ == '__main__':
    app.run(use_reloader=True, host='127.0.0.1', port=3000)
