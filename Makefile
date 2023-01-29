.PHONY: lint
lint:
	npm run fmt

.PHONY: clean
clean:
	rm -rf tempDir book.epub
