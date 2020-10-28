ROOT=/home/igibek/Desktop/research/mininode/src
DIR=$(ROOT)/experiment/validation/reduction-test
all:
	mkdir mn linters
	cp -rf $(ROOT)/experiment/linters/* $(DIR)/linters 
	cp -rf $(ROOT)/src/* $(DIR)/mn
	docker build . -t localhost:5000/mn-reduction
	make clean
push:
	docker push localhost:5000/mn-reduction
clean:
	rm -rf $(DIR)/mn $(DIR)/linters