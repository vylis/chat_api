#
# LOCAL DEVELOPMENT
#

docker-start:
	docker-compose up -d

docker-stop: 
	docker-compose down --remove-orphans