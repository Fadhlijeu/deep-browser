"""
Main entrypoint for python -m deep_browser
"""

import sys
from deep_browser.cli import cli

if __name__ == "__main__":
    if len(sys.argv) == 1:
        # Default action when run as 'python -m deep_browser' is to start the bridge server
        sys.argv.append("serve")
    cli()
