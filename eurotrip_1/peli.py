import random
from geopy import distance
import mysql.connector
import story

conn = mysql.connector.connect(
    host='localhost',
    port=3306,
    database='demogame',
    user='root',
    password='5pöpö!',
    autocommit=True
)


def get_encounters():
    sql = "SELECT * FROM random_encounters;"
    cursor = conn.cursor(dictionary=True)
    cursor.execute(sql)
    result = cursor.fetchall()
    return result


def get_airports():
    sql = "SELECT * FROM airport;"
    cursor = conn.cursor(dictionary=True)
    cursor.execute(sql)
    result = cursor.fetchall()
    return result


def random_goal():
    sql = "SELECT goal_id FROM goal ORDER BY RAND() LIMIT 1;"
    cursor = conn.cursor(dictionary=True)
    cursor.execute(sql)
    result = cursor.fetchone()
    return result['goal_id']


def create_game(money, range_start, cur_location, p_name, g_goal, start_score, a_ports):
    sql = ('''INSERT INTO game (money_budget, range_budget, location, screen_name, game_goal, score)
           VALUES (%s, %s, %s, %s, %s, %s);''')
    cursor = conn.cursor(dictionary=True)
    cursor.execute(sql, (money, range_start, cur_location, p_name, g_goal, start_score))
    g_id = cursor.lastrowid

    random_encounters = get_encounters()
    encounter_list = []
    for re in random_encounters:
        for i in range(0, re['probability'], 1):
            encounter_list.append(re['re_id'])

    g_ports = a_ports.copy()
    random.shuffle(g_ports)

    for i, re_id in enumerate(encounter_list):
        sql = "INSERT INTO encounter_location (el_game, el_location, el_encounter, visited) VALUES (%s, %s, %s, 0);"
        cursor = conn.cursor(dictionary=True)
        cursor.execute(sql, (g_id, g_ports[i]['ident'], re_id))

    return g_id


def get_airport_info(icao):
    sql = f'''SELECT iso_country, ident, name, latitude_deg, longitude_deg, population, is_capital, passengers
            FROM airport WHERE ident = %s'''
    cursor = conn.cursor(dictionary=True)
    cursor.execute(sql, (icao,))
    result = cursor.fetchone()
    return result


def get_game_info(game_id):
    sql = f'''SELECT screen_name, money_budget, range_budget, score, location, game_goal
            FROM game WHERE id = %s'''
    cursor = conn.cursor(dictionary=True)
    cursor.execute(sql, (game_id,))
    result = cursor.fetchone()
    return result


def reference(goal_id):
    sql = f'SELECT reference FROM goal WHERE goal_id = (%s);'
    cursor = conn.cursor(dictionary=True)
    cursor.execute(sql, (goal_id,))
    ref = cursor.fetchone()
    return ref['reference']


def check_if_visited(game_id, current_location):
    # "SELECT EXISTS" kokeilee, onko olemassa riviä, joka toteuttaa sulkujen sisällä olevat ehdot
    # jos ei ole, se palauttaa 0, jos on, se palauttaa 1
    sql = f'SELECT EXISTS(SELECT * from visited_city WHERE id_game = %s AND location = %s)'
    cursor = conn.cursor(dictionary=True)
    cursor.execute(sql, (game_id, current_location,))
    fetched = cursor.fetchone()
    # list() tekee sql syöttämästä taulukosta python listan
    result = list(fetched.values())[0]
    if result == 1:
        return True
    else:
        return False


def update_visited_status(game_id, location):
    already_visited = check_if_visited(game_id, location)
    if already_visited:
        pass
    else:
        sql = f'INSERT INTO visited_city VALUES (%s, %s, 1);'
        cursor = conn.cursor(dictionary=True)
        cursor.execute(sql, (game_id, location))


def check_if_goal(game_id, player_location, goal_id):
    check = 0
    ref = reference(goal_id)
    if check_if_visited(game_id, player_location):
        check = 2
    elif not check_if_visited(game_id, player_location):
        if ref == 'is_capital':
            sql = f'SELECT municipality, ident FROM airport WHERE is_capital = 1;'
        else:
            sql = f'SELECT DISTINCT municipality, ident, {ref} FROM airport ORDER BY {ref} DESC LIMIT 31;'
        cursor = conn.cursor(dictionary=True)
        cursor.execute(sql)
        correct_ports = cursor.fetchall()
        for port in correct_ports:
            if port['ident'] == player_location:
                check = 1
    return check


def check_if_re(game_id, player_location):
    check = 0
    if check_if_visited(game_id, player_location):
        check = 2
    elif not check_if_visited(game_id, player_location):
        sql = 'SELECT EXISTS(SELECT el_encounter FROM encounter_location WHERE el_game = %s AND el_location = %s);'
        cursor = conn.cursor(dictionary=True)
        cursor.execute(sql, (game_id, player_location,))
        fetched = cursor.fetchone()
        result = list(fetched.values())[0]
        if result == 1:
            check = 1
    return check


def check_which_re(game_id, location):
    has_re = check_if_re(game_id, location)
    if has_re == 1:
        sql = f'SELECT el_encounter FROM encounter_location WHERE el_game = %s AND el_location = %s;'
        cursor = conn.cursor(dictionary=True)
        cursor.execute(sql, (game_id, location,))
        result = cursor.fetchone()
        return result['el_encounter']
    else:
        return 0


def effect_string(re_id):
    sql = f'SELECT effect FROM random_encounters WHERE re_id = (%s);'
    cursor = conn.cursor(dictionary=True)
    cursor.execute(sql, (re_id,))
    ref = cursor.fetchone()
    return ref['effect']


def re_info(game_id, location):
    re_id = check_which_re(game_id, location)
    sql = f'SELECT re_title, re_description, effect, value FROM random_encounters WHERE re_id = (%s);'
    cursor = conn.cursor(dictionary=True)
    cursor.execute(sql, (re_id,))
    ref = cursor.fetchone()
    return ref


def get_distance(current, target):
    start = get_airport_info(current)
    end = get_airport_info(target)
    return distance.distance((start['latitude_deg'], start['longitude_deg']),
                             (end['latitude_deg'], end['longitude_deg'])).km


def airports_in_range(icao, a_ports, range_left):
    in_range = []
    for port in a_ports:
        dist = get_distance(icao, port['ident'])
        if dist <= range_left and not dist == 0:
            in_range.append(port)
    return in_range


def update_location(game_id, range, money, location):
    sql = f'''UPDATE game SET location = %s, range_budget = %s, money_budget = %s WHERE id = %s'''
    cursor = conn.cursor(dictionary=True)
    cursor.execute(sql, (location, range, money, game_id,))


def update_score(game_id, score):
    sql = f'''UPDATE game SET score = %s WHERE id = %s'''
    cursor = conn.cursor(dictionary=True)
    cursor.execute(sql, (score, game_id,))


def is_valid(icao):
    this_all_airports = get_airports()
    for i in this_all_airports:
        if i['ident'] == icao:
            return True
    return False


def high_scores():
    sql = f'SELECT screen_name, score FROM game WHERE score IS NOT NULL ORDER BY score asc LIMIT 10;'
    cursor = conn.cursor(dictionary=True)
    cursor.execute(sql)
    result = cursor.fetchall()
    return result


def high_score_list():
    print("\x1b[31mTOP 10:\x1b[0m")
    all = high_scores()
    count = 0
    for i in all:
        count += 1
        name = i['screen_name']
        score = str(i['score'])
        dot_amount = 20 - len(name) - len(score)
        dots = dot_amount * '.'
        print(f'{count}. {name} {dots} {score}')
    print('')


def press_enter():
    print('')
    input("\033[93mPaina [ENTER] jatkaaksesi >> \033[0m")
    print('')


print("\033[94m\033[1mEUROTRIP\033[1m\033[0m")
name = input("Syötä nimesi aloittaaksesi: ")
stamps = 0
game_over = 0

print_story = input("Haluatko kuulla pelin tarinan? [Y/N] ")
if print_story.upper() == "Y":
    print(story.story)
    press_enter()

money = 2000
player_range = 800
all_airports = get_airports()
start_airport = "EFHK"
current_airport = start_airport
goal = random_goal()
loan_taken = None

game_id = create_game(money, player_range, start_airport, name, goal, loan_taken, all_airports)

loan_taken = 0

if goal == 1:
    print("\033[93mTavoitteesi on kerätä leimat Euroopan suurimmista kaupungeista!")
elif goal == 2:
    print("\033[93mTavoitteesi on kerätä leimat Euroopan vilkkaimmista lentokentistä!")
elif goal == 3:
    print("\033[93mTavoitteesi on kerätä leimat Euroopan pääkaupungeista!")
print("\033[0mKerää 5 leimaa voittaaksesi.")
print("Mitä pienemmällä lainalla selviät, sitä enemmän pisteitä saat!")


while stamps < 5:
    airport = get_airport_info(current_airport)
    print(f"\x1b[31mOlet tässä:\x1b[0m {airport['name']}")
    print(f"Sinulla on {money:.0f} € ja {player_range:.0f} km käytössäsi")
    press_enter()
    menu = input("""\033[92m[1] LENTOKENTTÄ: Mene seuraavaan kohteeseen
[2] KAUPPA: Osta kilometrejä
[3] PANKKI: Ota lainaa
[99] POISTU PELISTÄ \033[0m
""")
    print('')
    try:
        menu = int(menu)
    except ValueError:
        pass
    if menu == 1:
        in_range = airports_in_range(current_airport, all_airports, player_range)
        if not in_range:
            print("Ei lentokenttiä kilometrien säteellä!")
            print("\033[93mVinkki: Osta lisää kilometrejä.\033[0m")
        presentation = ''
        for i in in_range:
            n = i['name']
            m = i['municipality']
            i = i['ident']
            d = get_distance(current_airport, i)
            visited = check_if_visited(game_id, i)
            if visited == 1:
                add_string = '\x1b[31m (Käyty)\x1b[0m'
            else:
                add_string = ''
            print(f'{n}, \033[92m{m}\033[0m ({i}) {d:.0f} km' + add_string)
        icao = input(f"""\033[93mKilometrejä käytössä: {player_range:.0f} km
        
\033[94mMinne haluat matkustaa?\033[0m
Syötä ICAO-koodi TAI [X] jos haluat peruuttaa """)
        icao = icao.upper()
        if icao == "X":
            pass
        elif is_valid(icao) and player_range >= get_distance(current_airport, icao):
            player_range = player_range - get_distance(current_airport, icao)
            check = check_if_goal(game_id, icao, goal)
            re_check = check_if_re(game_id, icao)
            if re_check == 1:
                encounter_info = re_info(game_id, icao)
                print(encounter_info['re_description'])
                re_value = encounter_info['value']
                re_effect = encounter_info['effect']
                if re_effect == "range_budget":
                    player_range += re_value
                if re_effect == "money_budget":
                    money += re_value
                    if money < 0:
                        if loan_taken >= 50000:
                            print("Rahat loppuivat!")
                            game_over = 1
                            break
                        else:
                            print("Rahat loppuivat!")
                            print("\033[93mVinkki: Voit vielä nostaa rahaa pankista!\033[0m")
            update_visited_status(game_id, icao)
            update_location(game_id, player_range, money, icao)
            current_airport = icao
            airport = get_airport_info(current_airport)
            if check == 0:
                print(f"Täällä ei ollut leimaa!")
            if check == 1:
                print(f"Täällä oli leima!")
                print("\033[92m+1 leima\033[0m")
                stamps = stamps + 1
                print(f"Leimojen määrä: {stamps}")
            if check == 2:
                print("Tervetuloa takaisin! Täällä on jo käyty.")
            check2 = check_if_re(game_id, icao)
            if check2 == 1:
                testi = check_which_re(game_id, icao)
                print(testi)
        else:
            print("\033[1;37;40mLentokenttä ei kilometrien säteellä tai invalidi ICAO-koodi.\033[0m")
    elif menu == 2:
        print("Tervetuloa kauppaan!")
        print(f"Sinulla on {money:.0f} € ja {player_range:.0f} km käytössäsi.")
        print("HINNAT: 1 km = 2 €")
        osto = input("Paljonko haluat ostaa kilometrejä? ")
        try:
            osto = int(osto)
            hinta = osto * 2
            if hinta > money:
                print("Sinulla ei ole tarpeeksi rahaa!")
                print("\033[93mVinkki: Pankista voi nostaa lainaa.\033[0m")
            elif osto >= 0:
                varmistus = input(f"Haluatko käyttää {hinta} € ostaaksesi {osto} km? [Y/N] ")
                if varmistus.lower() != "n":
                    money = money - hinta
                    player_range = player_range + osto
                else:
                    pass
            else:
                print("\033[1;37;40mInvalidi määrä.\033[0m")
        except ValueError:
            print("\033[1;37;40mInvalidi kilometrimäärä.\033[0m")
    elif menu == 3:
        print("Tervetuloa pankkiin.")
        print(f"Sinulla on vain {money:.0f} €...")
        print(f"Maksimimäärä per peli: 30000 € / Lainaa otettu: {loan_taken} €")
        loan = input("Paljonko lainaa haluat ottaa? ")
        try:
            loan = int(loan)
            if loan >= 0 and loan_taken + loan <= 30000:
                money += loan
                loan_taken += loan
            else:
                print("\033[1;37;40mInvalidi määrä.\033[0m")
        except ValueError:
            print("\033[1;37;40mInvalidi määrä.\033[0m")
    elif menu == 99:
        break
    else:
        print("\033[1;37;40mInvalidi menukoodi.\033[0m")

if stamps >= 5:
    update_score(game_id, loan_taken)
    print("\033[93mVoitit pelin!\033[0m")
    print(f"Pisteet: {loan_taken}")
    print("")
    high_score_list()
elif game_over == 1:
    print("\x1b[31mGAME OVER:\x1b[0m Rahat loppuivat!")

credits = input("Haluatko nähdä lopputekstit? [Y/N] ")

if credits.upper() == "Y":
    print('''
\033[94m\033[1mEUROTRIP\033[1m\033[0m
Elina Kajava
Joonas Ronimus
Santtu Saaranen
Sergei Vilka
Metropolia Ammattikorkeakoulu, 2023
''')
