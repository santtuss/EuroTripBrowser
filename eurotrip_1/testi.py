import peli
import mysql.connector

pe = peli

conn = mysql.connector.connect(
    host='localhost',
    port=3306,
    database='demogame',
    user='root',
    password='5pöpö!',
    autocommit=True
)

testi_menu = input('''
[TESTI] mitä haluat tehdä?
[C] = clear tables 
[F] = kokeile funktioita 
[A] = luo uusi peli omilla parametreillä''')

if testi_menu == "F":
    gid = input("[TESTI] anna game_id: ")
    locat = input("[TESTI] anna sijainti: ")

    if pe.check_if_goal(gid, locat, 1) == 2:
        print("[TESTI] Ollaan käyty täällä jo")
    elif pe.check_if_goal(gid, locat, 1) == 1:
        print("[TESTI] Jee täällä on leima")
        pe.update_visited_status(gid, locat)
    else:
        print("[TESTI] Ei maalia")
        pe.update_visited_status(gid, locat)
if testi_menu == "C":
    delete = input("[TESTI] Haluatko poistaa kaiken tietokannoista game, encounter_location ja city_visited? [kirjoita 'DEL'] ")
    if delete == 'DEL':
        sql = '''DELETE FROM encounter_location;
        DELETE FROM visited_city;
        DELETE FROM game;'''
        cursor = conn.cursor(dictionary=True)
        cursor.execute(sql)
        print("[TESTI] valmis")
if testi_menu == "A":
    money = input("anna start money: ")
    range_start = input("anna start range: ")
    cur_location = input("anna aloituskaupunki (default EFHK): ")
    p_name = input("anna ns. screen_name: ")
    g_goal = pe.random_goal()
    start_score = 0
    a_ports = pe.get_airports()
    pe.create_game(money, range_start, cur_location, p_name, g_goal, start_score, a_ports)
