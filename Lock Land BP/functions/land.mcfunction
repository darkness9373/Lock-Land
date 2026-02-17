#lock_land

scoreboard objectives add create_timeout dummy
scoreboard players add @a[tag=pos1,tag=pos2] create_timeout 1
tag @a[scores={create_timeout=1200..}] add timeout