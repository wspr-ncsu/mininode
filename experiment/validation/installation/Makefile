ROOT=/home/igibek/Desktop/research/mininode/src
DIR=$(ROOT)/experiment/validation/installation
all:
	mkdir mn linters
	cp -rf $(ROOT)/experiment/linters/* $(DIR)/linters 
	cp -rf $(ROOT)/src/* $(DIR)/mn
	docker build . -t localhost:5000/mn-test
	make clean
push:
	docker push localhost:5000/mn-test
clean:
	rm -rf $(DIR)/mn $(DIR)/linters