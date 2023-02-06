.PHONY: lint
lint:
	npm run fmt

.PHONY: image
image:
	docker build -t out-of-pocket .
