ROOT=/home/igibek/Desktop/research/mininode/src
DIR=$(ROOT)/experiment/measurement/installations
all:
	mkdir mn
	cp -r $(ROOT)/src/* $(DIR)/mn/
	docker build . -t localhost:5000/mn-full
	make clean
push:
	docker push localhost:5000/mn-full
clean:
	rm -rf mn