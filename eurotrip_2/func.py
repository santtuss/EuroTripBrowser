from flask import Flask
from database import Database
from flask_cors import CORS
import random
from geopy import distance

db = Database()
app = Flask(__name__)
cors = CORS(app)
app.config['CORS_HEADERS'] = 'Content-Type'
conn = db.get_conn()


# palauttaa random_encounters taulun datan
@app.route('/get_encounters')
def get_encounters():
    sql = "SELECT * FROM random_encounters;"
    cursor = conn.cursor(dictionary=True)
    cursor.execute(sql)
    result = cursor.fetchall()
    return result


# palauttaa airport taulun datan
@app.route('/get_airports')
def get_airports():
    sql = "SELECT * FROM airport;"
    cursor = conn.cursor(dictionary=True)
    cursor.execute(sql)
    result = cursor.fetchall()
    return result


# argumenttina icao-koodi, palauttaa icao koodia vastaavan lentokentän tiedot
@app.route('/get_airport_info/<icao>')
def get_airport_info(icao):
    sql = f'''SELECT iso_country, ident, name, latitude_deg, longitude_deg, population, is_capital, passengers, municipality
            FROM airport WHERE ident = %s'''
    cursor = conn.cursor(dictionary=True)
    cursor.execute(sql, (icao,))
    result = cursor.fetchone()
    return result


# argumentteina game id ja sijainti
# palauttaa json rivin -> "visited": False/True
@app.route('/check_if_visited/<game_id>/<current_location>')
def check_if_visited(game_id, current_location):
    sql = f'SELECT EXISTS(SELECT * from visited_city WHERE id_game = %s AND location = %s)'
    cursor = conn.cursor(dictionary=True)
    cursor.execute(sql, (game_id, current_location,))
    fetched = cursor.fetchone()
    result = list(fetched.values())[0]
    if result == 0:
        return {"visited": False}
    elif result == 1:
        return {"visited": True}

# päivittää visited statuksen
# palauttaa json ->
# "location": location (annettu sijainti)
# "visited": 1
@app.route('/update_visited_status/<game_id>/<location>')
def update_visited_status(game_id, location):
    already_visited = check_if_visited(game_id, location)["visited"]
    if already_visited:
        pass
    else:
        sql = f'INSERT INTO visited_city VALUES (%s, %s, 1);'
        cursor = conn.cursor(dictionary=True)
        cursor.execute(sql, (game_id, location))
    return {"location": location, "visited": 1}


# argumenttina sijainti, palauttaa json
# "has_goal": True/False
@app.route('/check_if_goal/<player_location>')
def check_if_goal(player_location):
    check = False
    sql = f'SELECT DISTINCT municipality, ident, population FROM airport ORDER BY population DESC LIMIT 31;'
    cursor = conn.cursor(dictionary=True)
    cursor.execute(sql)
    correct_ports = cursor.fetchall()
    for port in correct_ports:
        if port['ident'] == player_location:
            check = True
    return {"has_goal": check}


# argumentteina game id ja sijainti palauttaa json
# "has_re": True/False
# false myös silloin jos on käyty jo vaikka on ollut aiemmin
@app.route('/check_if_re/<game_id>/<player_location>')
def check_if_re(game_id, player_location):
    re_status = False
    if check_if_visited(game_id, player_location)["visited"]:
        re_status = False
    else:
        sql = 'SELECT EXISTS (SELECT el_encounter FROM encounter_location WHERE el_game = %s AND el_location = %s);'
        cursor = conn.cursor(dictionary=True)
        cursor.execute(sql, (game_id, player_location,))
        fetched = cursor.fetchone()
        result = list(fetched.values())[0]
        if result == 1:
            re_status = True
    return {"has_re": re_status}


# argumentteina game id ja sijainti, palauttaa 0 jos ei ole random encounteria/on käyty jo
# palauttaa random encounterin idn ("el_encounter") paikassa json muodossa
# "re_id": numero
# ("re_id": 0 jos ei ole random encounteria)
@app.route('/check_which_re/<game_id>/<location>')
def check_which_re(game_id, location):
    if check_if_re(game_id, location)["has_re"]:
        sql = f'SELECT el_encounter FROM encounter_location WHERE el_game = %s AND el_location = %s;'
        cursor = conn.cursor(dictionary=True)
        cursor.execute(sql, (game_id, location,))
        result = cursor.fetchone()
        return {"re_id": result['el_encounter']}
    else:
        return {"re_id": 0}


# argumentit player name ja aloitussijainti
# palauttaa automaattisesti luodun game id + päivittää databaseen uuden pelin tiedot
# "game_id": g_id

@app.route('/create_game/<p_name>/<start_location>')
def create_game(p_name, start_location):
    print("ok")
    sql = (f'''INSERT INTO game (money_budget, range_budget, location, screen_name, score)
    VALUES (2000, 1000, "{start_location}", "{p_name}", 0);''')
    cursor = conn.cursor(dictionary=True)
    cursor.execute(sql)
    g_id = cursor.lastrowid

    random_encounters = get_encounters()
    encounter_list = []
    for re in random_encounters:
        for i in range(0, re['probability'], 1):
            encounter_list.append(re['re_id'])

    g_ports = get_airports().copy()
    random.shuffle(g_ports)

    for i, re_id in enumerate(encounter_list):
        sql = ("INSERT INTO encounter_location (el_game, el_location, el_encounter, visited) VALUES (%s, %s, %s, 0);")
        cursor = conn.cursor(dictionary=True)
        cursor.execute(sql, (g_id, g_ports[i]['ident'], re_id))

    sql = "DELETE FROM `encounter_location` WHERE `el_location` = 'EFHK';"
    cursor = conn.cursor(dictionary=True)
    cursor.execute(sql,)
    return {"game_id": g_id}


# argumentit ensimmäinen ja toinen sijainti
# palauttaa sijaintien välisen etäisyyden
# "distance": float numero
@app.route('/get_distance/<current>/<target>')
def get_distance(current, target):
    start = get_airport_info(current)
    end = get_airport_info(target)
    result_distance = distance.distance((start['latitude_deg'], start['longitude_deg']),(end['latitude_deg'], end['longitude_deg'])).km
    return {"distance": result_distance}


# game id ja sijainti argumentteina
# palauttaa informaation sijainnin random_encounterista
# jos ei ole random encounteria palauttaa vain yhden rivin: {"re_id": 0}
@app.route('/re_info/<game_id>/<location>')
def re_info(game_id, location):
    re_id = check_which_re(game_id, location)["re_id"]
    sql = f'SELECT re_id, re_title, re_description, effect, value FROM random_encounters WHERE re_id = (%s);'
    cursor = conn.cursor(dictionary=True)
    cursor.execute(sql, (re_id,))
    ref = cursor.fetchone()
    if ref is None:
        return {"re_id": 0}
    else:
        return ref


# palauttaa listan lentokentistä annetulla sijainnilla ja rangella
@app.route('/airports_in_range/<icao>/<range_left>')
def airports_in_range(icao, range_left):
    in_range = []
    for port in get_airports():
        dist = get_distance(icao, port['ident'])['distance']
        if dist <= float(range_left) and not dist == 0:
            in_range.append(port)
    return in_range


# päivittää peli tauluun sijainnin rangen ja rahan
@app.route('/update_location/<game_id>/<range>/<money>/<location>')
def update_location(game_id, range, money, location):
    sql = f'''UPDATE game SET location = %s, range_budget = %s, money_budget = %s WHERE id = %s'''
    cursor = conn.cursor(dictionary=True)
    cursor.execute(sql, (location, range, money, game_id,))
    return {"game_id": game_id, "location": location, "range": range, "money": money}


# päivittää peli tauluun scoren
@app.route('/update_score/<game_id>/<score>')
def update_score(game_id, score):
    sql = f'''UPDATE game SET score = %s WHERE id = %s'''
    cursor = conn.cursor(dictionary=True)
    cursor.execute(sql, (score, game_id,))
    return {"game_id": game_id, "score": score}

# palauttaa json {"is_valid": True/False} sen perusteella onko icaota olemassa meidän lentokentissä
# (tod näk turha..)
@app.route('/is_valid/<icao>')
def is_valid(icao):
    this_all_airports = get_airports()
    for i in this_all_airports:
        if i['ident'] == icao:
            return {"is_valid": True}
    return {"is_valid": False}


@app.route('/high_scores')
def high_scores():
    sql = f'SELECT screen_name, score FROM game WHERE score IS NOT NULL ORDER BY score desc LIMIT 10;'
    cursor = conn.cursor(dictionary=True)
    cursor.execute(sql)
    result = cursor.fetchall()
    return result


if __name__ == '__main__':
    app.run(use_reloader=True, host='127.0.0.1', port=3000)
