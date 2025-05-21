.ONESHELL:

include .env
export

# Define the SUDO variable; default to sudo if not overridden
SUDO ?= sudo

common:
	export TZ="Europe/Berlin"
	# $(SUDO) ln -snf /usr/share/zoneinfo/${TZ} /etc/localtime && $(SUDO) echo ${TZ} > /etc/timezone

	$(SUDO) apt-get update

generate-devcontainer:
	python3 .devcontainer/gen_dev_container.py

devcontainer_deps: common
	uv pip install --system -e ".[dev]"

	corepack enable
	corepack prepare yarn@$(YARN_VERSION) --activate
	yarn install

django_secret_key:
	@python3 -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"

prepare_django: run_rspack
	$(PYTHON) manage.py makemigrations
	$(PYTHON) manage.py migrate
	$(PYTHON) manage.py tailwind install
	$(PYTHON) manage.py collectstatic --noinput
	
run_tests: prepare_django
	$(PYTHON) -Wa manage.py test --noinput --parallel 8

run_tailwind: prepare_django
	nohup $(PYTHON) manage.py tailwind start > $(LOG_DIR)/tailwind.log 2>&1 &

run_rspack:
	mkdir -p $(LOG_DIR)
	nohup yarn watch > $(LOG_DIR)/rspack.log 2>&1 &

run_server: run_tailwind
	$(PYTHON) manage.py collectstatic --noinput
	nohup $(PYTHON) manage.py runserver 0.0.0.0:8000 > $(LOG_DIR)/django_server.log 2>&1 &

run_website: run_server

stop_rspack:
	-pkill -f "rspack"

kill: stop_rspack
	killall $(PYTHON)