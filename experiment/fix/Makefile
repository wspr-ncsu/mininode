ROOT=/home/igibek/Desktop/research/mininode/src
DIR=$(ROOT)/experiment/measurement/installations
all:
	docker build . -t localhost:5000/mn-fix
	make clean
push:
	docker push localhost:5000/mn-fix
clean:
	rm -rf mn